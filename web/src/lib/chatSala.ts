import { prisma } from "@/lib/prisma";

/**
 * Regras comuns às rotas da sala de chat (GET/POST /api/chat/[roomId] e
 * /api/chat/[roomId]/messages). Antes cada rota tinha a sua cópia, e elas
 * divergiam: a de mensagens não aceitava AGUARDANDO_FINALIZACAO.
 */

/** Status do serviço com chat disponível (ativo ou arquivado, somente leitura). */
export const STATUS_COM_CHAT: ReadonlySet<string> = new Set([
  "ACEITO",
  "EM_ANDAMENTO",
  // Sem este status, ao empregador confirmar a finalização primeiro o chat caía
  // em 403 para ambas as partes justamente na etapa de fechar o serviço.
  "AGUARDANDO_FINALIZACAO",
  "CONCLUIDO",
  "CONFIRMADO",
  "FINALIZADO",
]);

/**
 * Status do serviço em que a conversa está ARQUIVADA (somente leitura).
 *
 * Os três só existem DEPOIS da execução: CONCLUIDO = as duas partes
 * confirmaram a finalização (confirmar-finalizacao); CONFIRMADO = o empregador
 * aprovou (POST /confirmar, único escritor, e só a partir de CONCLUIDO);
 * FINALIZADO = avaliado. Nenhuma rota tira um serviço desses estados.
 * AGUARDANDO_FINALIZACAO NÃO entra: só uma parte confirmou, o serviço ainda
 * pode ser concluído ou cancelado e o chat continua aberto para escrita.
 */
export const STATUS_ARQUIVADO: ReadonlySet<string> = new Set(["CONCLUIDO", "CONFIRMADO", "FINALIZADO"]);

/**
 * Regra PROVISÓRIA de pagamento: só PAYMENT_CONFIRMED libera a exclusão.
 *
 * As rotas de PIX aceitam serviço arquivado, e hoje o app só oferece as ações
 * de pagamento no banner DENTRO da conversa (pagar/informar, do empregador;
 * confirmar/contestar, do profissional). Com a conversa excluída, quem
 * excluiu perderia o único lugar para concluir ou contestar um pagamento:
 *  - PAYMENT_REPORTED: o profissional ainda precisa confirmar ou contestar;
 *  - PAYMENT_DISPUTED: o empregador precisa corrigir ou pagar de novo;
 *  - WAITING_PAYMENT: é o default de todo serviço. Não prova pagamento (pode
 *    ter sido pago fora do app ou não ter sido pago) e o PIX ainda pode ser
 *    informado depois — o que exigiria a confirmação do profissional.
 * Quando as ações de pagamento existirem também no detalhe do serviço, esta
 * condição deixa de ser necessária (a exclusão passa a depender só do status).
 */
const PAGAMENTO_LIBERA_EXCLUSAO = "PAYMENT_CONFIRMED";

export type MotivoSemExclusao = "CONVERSA_ATIVA" | "PAGAMENTO_PENDENTE";

/**
 * Regra ÚNICA de exclusão. Autoriza o DELETE e é a mesma que devolve
 * `podeExcluir` na lista e na sala — o app não decide sozinho. `null` = pode.
 */
export function motivoParaNaoExcluir(servico: { status: string; paymentStatus: string | null }): MotivoSemExclusao | null {
  if (!STATUS_ARQUIVADO.has(servico.status)) return "CONVERSA_ATIVA";
  if (servico.paymentStatus !== PAGAMENTO_LIBERA_EXCLUSAO) return "PAGAMENTO_PENDENTE";
  return null;
}

export function podeExcluirConversa(servico: { status: string; paymentStatus: string | null }): boolean {
  return motivoParaNaoExcluir(servico) === null;
}

/**
 * Resposta das rotas da sala para quem excluiu a conversa. 404, e não 403: para
 * essa pessoa a conversa não existe mais. O `code` deixa o app explicar o
 * motivo em vez de mostrar um erro genérico.
 */
export const RESPOSTA_CONVERSA_EXCLUIDA = {
  ok: false,
  error: "Esta conversa foi excluída.",
  code: "CONVERSA_EXCLUIDA",
} as const;

/**
 * A pessoa tirou esta conversa dos próprios Arquivados (ChatRoomExclusao)?
 * As rotas da sala consultam isto ANTES de devolver qualquer coisa: uma
 * notificação antiga, um link ou o cache do aparelho não reabrem a conversa.
 * Vale só para `userId` — o outro participante continua com acesso.
 */
export async function conversaExcluidaPor(servicoId: string, userId: string): Promise<boolean> {
  const exclusao = await prisma.chatRoomExclusao.findFirst({
    where: { userId, room: { servicoId } },
    select: { id: true },
  });
  return exclusao !== null;
}

/** Filtro de ChatRoom: só as salas que `userId` NÃO excluiu. */
export function salasNaoExcluidasPor(userId: string) {
  return { exclusoes: { none: { userId } } };
}

/** Tamanho da página de mensagens. */
export const PAGINA_MENSAGENS = 50;

/**
 * Ordem determinística: mais recente primeiro; empate de `createdAt` resolvido
 * pelo id. Sem o desempate, duas mensagens no mesmo milissegundo podiam trocar
 * de lugar entre consultas (e sumir ou repetir entre páginas).
 */
export const MAIS_RECENTES_PRIMEIRO = [{ createdAt: "desc" as const }, { id: "desc" as const }];

/** Condição "estritamente anterior ao cursor" na mesma ordem (createdAt, id). */
export function anterioresAo(cursor: { createdAt: Date; id: string }) {
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  };
}

/**
 * Confirmação de leitura: marca como lidas SÓ as mensagens do outro
 * participante que foram DEVOLVIDAS nesta resposta (as que a pessoa recebe
 * para ver). O limite é o conjunto de ids devolvidos: uma mensagem gravada
 * depois da consulta não entra, e uma mais antiga que a página também não.
 * `readAt: null` no filtro mantém o primeiro horário de leitura (idempotente
 * entre consultas concorrentes); `roomId`/`senderId` garantem que nada fora
 * desta sala, ou enviado pela própria pessoa, seja tocado.
 */
export async function marcarDevolvidasComoLidas(
  roomId: string,
  outroUsuarioId: string | null,
  mensagens: Array<{ id: string; senderId: string; readAt: Date | null }>,
): Promise<void> {
  if (!outroUsuarioId) return;
  const ids = mensagens.filter((m) => m.senderId === outroUsuarioId && m.readAt === null).map((m) => m.id);
  if (ids.length === 0) return;
  const agora = new Date();
  await prisma.chatMessage.updateMany({
    where: { id: { in: ids }, roomId, senderId: outroUsuarioId, readAt: null },
    data: { readAt: agora },
  });
  // Reflete nas mensagens já carregadas (sem nova query).
  const marcadas = new Set(ids);
  for (const m of mensagens) if (marcadas.has(m.id)) m.readAt = agora;
}
