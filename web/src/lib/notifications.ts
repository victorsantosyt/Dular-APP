import { prisma } from "@/lib/prisma";
import { conteudoPublico, dadosPublicos } from "@/lib/pushPublico";
import { createHash } from "node:crypto";
import { pushBloqueadoNoPreview, pushRemotoPermitido } from "@/lib/ambientePreview";

// ──────────────────────────────────────────────────────────────────────────
// Notificações in-app + push remoto (best-effort)
//
// Toda a comunicação transacional do app (T-16) passa por estes helpers.
// • `criarNotificacao` persiste a notificação no banco para a aba
//   "Notificações" do mobile e, em paralelo, dispara o push remoto.
// • `sendPushNotification` continua exportado por compatibilidade — vários
//   endpoints já o chamam diretamente; novos lugares devem preferir
//   `criarNotificacao` (que faz as duas coisas).
//
// Importante: falhas no envio (push remoto ou row no banco) **nunca** podem
// derrubar o endpoint principal. Todos os pontos críticos estão envolvidos
// em try/catch, e o erro é apenas logado no console.
// ──────────────────────────────────────────────────────────────────────────

export type NotificationType =
  | "SERVICO_SOLICITADO"
  | "SERVICO_ACEITO"
  | "SERVICO_RECUSADO"
  | "SERVICO_CANCELADO"
  | "SERVICO_INICIADO"
  | "SERVICO_AGUARDANDO_FINALIZACAO"
  | "SERVICO_FINALIZADO"
  | "SERVICO_CONFIRMADO"
  | "SERVICO_REAGENDAMENTO_PROPOSTO"
  | "SERVICO_REAGENDAMENTO_CONFIRMADO"
  | "SERVICO_REAGENDAMENTO_RECUSADO"
  | "CHAT_NOVA_MENSAGEM"
  | "PAGAMENTO_INFORMADO"
  | "PAGAMENTO_CONFIRMADO"
  | "PAGAMENTO_CONTESTADO"
  | "VERIFICACAO_APROVADA"
  | "VERIFICACAO_REPROVADA";

type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default";
  badge?: number;
  /** iOS: agrupa visualmente os avisos. Ver `threadIdDe`. */
  threadId?: string;
};

type PushTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: unknown;
};

/**
 * Códigos de erro de push documentados pela Expo. Só eles vão para o log.
 *
 * `ticket.message` e `ticket.details` são texto livre da Expo e podem trazer o
 * token do aparelho (ex.: DeviceNotRegistered). Nada disso é registrado: o
 * log recebe apenas um destes códigos, ou "erro_desconhecido".
 */
const CODIGOS_ERRO_EXPO = new Set([
  "DeviceNotRegistered",
  "MessageTooBig",
  "MessageRateExceeded",
  "MismatchSenderId",
  "InvalidCredentials",
]);

/**
 * Erros do Prisma que podem aparecer no log, como identificação estática.
 *
 * O `message` de um `PrismaClientValidationError` repete os dados da chamada
 * — em `notification.create`, título e corpo: nome de quem mandou, texto da
 * mensagem, bairro. Nunca registramos o erro nem a mensagem: só um código da
 * lista abaixo, a classe do erro traduzida para um nome fixo, ou
 * "erro_desconhecido".
 */
const CODIGOS_ERRO_PRISMA = new Set([
  "P1001", // banco inacessível
  "P1002", // tempo esgotado ao conectar
  "P1008", // operação expirou
  "P1017", // conexão encerrada pelo servidor
  "P2002", // violação de unicidade
  "P2003", // violação de chave estrangeira
  "P2024", // tempo esgotado no pool
  "P2025", // registro não encontrado
  "P2034", // conflito de transação
]);

const CLASSES_ERRO_PRISMA: Record<string, string> = {
  PrismaClientValidationError: "validacao",
  PrismaClientInitializationError: "inicializacao",
  PrismaClientUnknownRequestError: "requisicao_desconhecida",
  PrismaClientRustPanicError: "panico",
};

export function codigoDeErroPrisma(erro: unknown): string {
  if (erro && typeof erro === "object") {
    const codigo = (erro as { code?: unknown }).code;
    if (typeof codigo === "string" && CODIGOS_ERRO_PRISMA.has(codigo)) return codigo;
    const nome = (erro as { name?: unknown }).name;
    if (typeof nome === "string" && Object.prototype.hasOwnProperty.call(CLASSES_ERRO_PRISMA, nome)) {
      return CLASSES_ERRO_PRISMA[nome];
    }
  }
  return "erro_desconhecido";
}

export function codigoDeErroExpo(details: unknown): string {
  const codigo = details && typeof details === "object" ? (details as { error?: unknown }).error : undefined;
  return typeof codigo === "string" && CODIGOS_ERRO_EXPO.has(codigo) ? codigo : "erro_desconhecido";
}

/**
 * Em que pilha o aviso entra na tela de bloqueio do iPhone.
 *
 * Sem isto, TUDO cai num monte só: um pedido novo, três recados da mesma
 * pessoa e uma avaliação viram cinco cartões soltos sob "Dular", e quem olha
 * o telefone só lê o último. Conferido no simulador — com `thread-id` os
 * mesmos cinco viram três pilhas, e a conversa colapsa num cartão só.
 *
 * O agrupamento é por ASSUNTO, não por tipo de evento:
 * - a conversa inteira numa pilha (como o WhatsApp faz por contato);
 * - o serviço inteiro noutra, para "aceito → iniciado → finalizado" do mesmo
 *   trabalho não se espalharem pela tela;
 * - o resto (pagamento, avaliação, sistema) agrupado pelo próprio tipo.
 *
 * Derivado do `data` de propósito: assim vale também para os endpoints que
 * chamam `sendPushNotification` direto, sem passar por `criarNotificacao`.
 */
function threadIdDe(data?: Record<string, unknown>): string | undefined {
  if (!data) return undefined;
  const texto = (v: unknown) => (typeof v === "string" && v ? v : null);
  const tipo = texto(data.type);
  const servicoId = texto(data.servicoId);
  const chatRoomId = texto(data.chatRoomId);

  if (tipo === "CHAT_NOVA_MENSAGEM") {
    const sala = chatRoomId ?? servicoId;
    return sala ? `chat:${sala}` : undefined;
  }
  if (servicoId) return `servico:${servicoId}`;
  return tipo ? `tipo:${tipo}` : undefined;
}

/**
 * Número no ícone do app.
 *
 * É a soma dos DOIS contadores que o app já mostra nas abas: avisos não lidos
 * (o sino) e mensagens não lidas. É o total do que a pessoa ainda não viu.
 *
 * As notificações de chat ficam de fora da primeira parcela de propósito: elas
 * nunca são marcadas como lidas (ler a conversa marca a MENSAGEM, não a row de
 * notificação), então contá-las faria o número só crescer. Quem representa o
 * chat aqui é a contagem de mensagens, que zera de verdade.
 *
 * O valor é ABSOLUTO, não um incremento: cada push reafirma o total, então um
 * push perdido não desalinha o contador para sempre.
 */
async function badgeDoUsuario(userId: string): Promise<number | undefined> {
  try {
    const [avisos, mensagens] = await Promise.all([
      prisma.notification.count({
        where: { userId, readAt: null, type: { not: "CHAT_NOVA_MENSAGEM" } },
      }),
      prisma.chatMessage.count({
        where: {
          readAt: null,
          senderId: { not: userId },
          room: {
            // Conversa excluída pela pessoa não conta no ícone do app.
            exclusoes: { none: { userId } },
            servico: {
              OR: [{ clientId: userId }, { diaristaId: userId }, { montadorId: userId }],
            },
          },
        },
      }),
    ]);
    return avisos + mensagens;
  } catch (err) {
    console.error("[push] falha ao contar o badge:", codigoDeErroPrisma(err));
    return undefined;
  }
}

/**
 * Envia push remoto via Expo. Best-effort: nunca lança — erros são logados
 * e o fluxo principal segue normalmente. Em desenvolvimento (Expo Go) o
 * token pode não estar disponível: nesse caso a função simplesmente retorna.
 *
 * PRIVACIDADE: `_titulo` e `_corpo` NÃO vão para o push. O que o sistema
 * exibe vem de `lib/pushPublico` pelo `type` em `data` (texto fixo por tipo),
 * e `data` passa por uma lista de chaves de identificador. Os parâmetros
 * ficam na assinatura por compatibilidade com os call-sites; o conteúdo
 * completo é o que `criarNotificacao` grava no banco.
 */
export async function sendPushNotification(
  userId: string,
  _titulo: string,
  _corpo: string,
  data?: Record<string, unknown>
): Promise<void> {
  // Marca da conta no log: confere, por conta, que o push NÃO saiu, sem
  // registrar id nem token.
  const conta = () => createHash("sha256").update(userId).digest("hex").slice(0, 12);
  if (!pushRemotoPermitido()) {
    console.log(`[push] preview: envio remoto desligado conta=${conta()}`);
    return;
  }
  if (pushBloqueadoNoPreview(userId)) {
    console.log(`[push] preview: conta sem push (teste) conta=${conta()}`);
    return;
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushToken: true },
    });

    const token = user?.pushToken;
    if (!token || !token.startsWith("ExponentPushToken[")) return;

    const publicos = dadosPublicos(data?.type, data);
    const { title, body } = conteudoPublico(publicos.type);
    // Derivado só de identificadores já filtrados.
    const threadId = threadIdDe(publicos);
    const badge = await badgeDoUsuario(userId);

    // Sem `subtitle`: ele levava tipo, data e bairro do serviço para a tela
    // de bloqueio do iPhone.
    //
    // `destinatarioId` em TODO push, definido AQUI pelo servidor e acrescentado
    // DEPOIS do filtro: `dadosPublicos` não o aceita do chamador, então ninguém
    // o forja nem o sobrescreve. Com o app aberto, o aparelho descarta aviso
    // que não é da conta autenticada. Não impede o sistema de mostrar o aviso
    // (neutro) com o app fechado.
    const message: PushMessage = {
      to: token,
      title,
      body,
      sound: "default",
      data: { ...publicos, destinatarioId: userId },
      ...(threadId ? { threadId } : {}),
      ...(badge !== undefined ? { badge } : {}),
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
    };

    if (process.env.EXPO_ACCESS_TOKEN) {
      headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
    }

    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers,
      body: JSON.stringify(message),
    });

    const json = (await res.json()) as { data?: PushTicket };
    const ticket = json.data;
    if (ticket?.status === "error") {
      console.error("[push] erro ao enviar notificação:", codigoDeErroExpo(ticket.details));
    }
  } catch {
    // Mensagem fixa: o texto de uma exceção aqui (rede, JSON da Expo, banco)
    // pode carregar o token ou o payload.
    console.error("[push] falha na chamada à Expo Push API.");
  }
}

export type CriarNotificacaoParams = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  servicoId?: string | null;
  chatRoomId?: string | null;
  /**
   * Quando definido, substitui o `data` padrão do push remoto
   * (`{ servicoId, chatRoomId, notificationId }`). O `type` é sempre o da
   * notificação, e só chaves de identificador chegam ao aparelho
   * (lib/pushPublico) — chave extra é descartada.
   */
  pushData?: Record<string, unknown>;
  /**
   * Quando `false`, apenas cria a row in-app e pula o push remoto.
   * Útil para notificações em massa onde push individual não faz sentido.
   * Padrão: `true`.
   */
  sendPush?: boolean;
};

/**
 * Cria uma notificação in-app e dispara o push remoto (best-effort).
 *
 * Esta é a função preferencial para qualquer notificação transacional do
 * app. Falhas em qualquer etapa são apenas logadas — nunca propagadas —
 * para garantir que o endpoint principal sempre conclua com sucesso.
 */
export async function criarNotificacao(params: CriarNotificacaoParams) {
  const {
    userId,
    type,
    title,
    body,
    servicoId = null,
    chatRoomId = null,
    pushData,
    sendPush = true,
  } = params;

  let notification: { id: string } | null = null;
  try {
    notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        servicoId,
        chatRoomId,
      },
      select: { id: true },
    });
  } catch (e) {
    // Nunca o erro inteiro: a mensagem do Prisma repete título e corpo.
    console.error("[notifications] erro criando notification in-app:", codigoDeErroPrisma(e));
  }

  if (sendPush) {
    // `type` é SEMPRE o da notificação: é ele que escolhe o texto público, e
    // um `pushData` com outro tipo não pode trocar o que aparece na tela.
    const data: Record<string, unknown> = {
      ...(pushData ?? {
        ...(servicoId ? { servicoId } : {}),
        ...(chatRoomId ? { chatRoomId } : {}),
        ...(notification?.id ? { notificationId: notification.id } : {}),
      }),
      type,
    };
    // sendPushNotification já trata erros internamente; este await é seguro.
    await sendPushNotification(userId, title, body, data);
  }

  return notification;
}

/**
 * Push de uma notificação JÁ gravada — por exemplo, na mesma transação da
 * decisão que a originou. Best-effort: nunca lança, e não regrava nada.
 */
export async function enviarPushDaNotificacao(n: {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
}): Promise<void> {
  await sendPushNotification(n.userId, n.title, n.body, { type: n.type, notificationId: n.id }).catch(() => {
    console.error("[push] falha ao enviar o aviso já gravado.");
  });
}

/**
 * Alias semântico para deixar explícito nos call-sites que o push é
 * best-effort. Internamente delega para `sendPushNotification`.
 */
export async function enviarPushBestEffort(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  await sendPushNotification(userId, title, body, data);
}
