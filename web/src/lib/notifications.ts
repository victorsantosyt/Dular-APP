import { prisma } from "@/lib/prisma";

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
  | "PAGAMENTO_CONTESTADO";

type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default";
  badge?: number;
  /** iOS: linha em negrito entre título e corpo. Ver `subtituloDoServico`. */
  subtitle?: string;
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

const ROTULO_TIPO: Record<string, string> = {
  FAXINA: "Faxina",
  FAXINEIRA: "Faxina",
  BABA: "Babá",
  COZINHEIRA: "Cozinheira",
  PASSA_ROUPA: "Passar roupa",
  LAVADEIRA: "Lavar roupa",
  CUIDADORA: "Cuidadora",
  MONTADOR: "Montagem",
};

/**
 * Segunda linha do aviso (iOS mostra em negrito entre título e corpo).
 *
 * Diz DE QUAL serviço o aviso fala. Sem ela, quem tem três serviços em
 * andamento lê "Sua solicitação foi aceita" e não sabe qual foi — precisa
 * abrir o app para descobrir. Com ela: "Faxina · 12 de set, Centro".
 *
 * Fica aqui, e não em cada endpoint, porque são mais de dez lugares criando
 * notificação: uma consulta central serve todos e não deixa nenhum de fora.
 * Best-effort como o resto do envio — se falhar, o push vai sem a linha.
 */
async function subtituloDoServico(servicoId: string): Promise<string | undefined> {
  try {
    const servico = await prisma.servico.findUnique({
      where: { id: servicoId },
      select: { tipo: true, data: true, bairro: true },
    });
    if (!servico) return undefined;

    const partes: string[] = [];
    const rotulo = ROTULO_TIPO[servico.tipo];
    if (rotulo) partes.push(rotulo);

    if (servico.data) {
      // `data` é data-pura gravada à meia-noite UTC; formatar em UTC evita
      // que o fuso do servidor mostre o dia anterior.
      partes.push(
        new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" })
          .format(servico.data)
          .replace(".", ""),
      );
    }
    if (servico.bairro) partes.push(servico.bairro);

    return partes.length > 0 ? partes.join(" · ") : undefined;
  } catch (err) {
    console.error("[push] falha ao montar o subtítulo:", err);
    return undefined;
  }
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
            servico: {
              OR: [{ clientId: userId }, { diaristaId: userId }, { montadorId: userId }],
            },
          },
        },
      }),
    ]);
    return avisos + mensagens;
  } catch (err) {
    console.error("[push] falha ao contar o badge:", err);
    return undefined;
  }
}

/**
 * Envia push remoto via Expo. Best-effort: nunca lança — erros são logados
 * e o fluxo principal segue normalmente. Em desenvolvimento (Expo Go) o
 * token pode não estar disponível: nesse caso a função simplesmente retorna.
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushToken: true },
    });

    const token = user?.pushToken;
    if (!token || !token.startsWith("ExponentPushToken[")) return;

    const threadId = threadIdDe(data);
    const servicoId = typeof data?.servicoId === "string" ? data.servicoId : null;

    const [subtitle, badge] = await Promise.all([
      servicoId ? subtituloDoServico(servicoId) : Promise.resolve(undefined),
      badgeDoUsuario(userId),
    ]);

    const message: PushMessage = {
      to: token,
      title,
      body,
      sound: "default",
      ...(data ? { data } : {}),
      ...(threadId ? { threadId } : {}),
      ...(subtitle ? { subtitle } : {}),
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
      console.error("[push] erro ao enviar notificação:", ticket.message, ticket.details);
    }
  } catch (err) {
    console.error("[push] falha na chamada à Expo Push API:", err);
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
   * Quando definido, sobrescreve o `data` do push remoto. Por padrão
   * incluímos `{ type, servicoId, chatRoomId }` para o mobile rotear a
   * notificação para a tela correta.
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
    console.error("[notifications] erro criando notification in-app:", e);
  }

  if (sendPush) {
    const data: Record<string, unknown> = pushData ?? {
      type,
      ...(servicoId ? { servicoId } : {}),
      ...(chatRoomId ? { chatRoomId } : {}),
      ...(notification?.id ? { notificationId: notification.id } : {}),
    };
    // sendPushNotification já trata erros internamente; este await é seguro.
    await sendPushNotification(userId, title, body, data);
  }

  return notification;
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
