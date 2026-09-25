/**
 * Para onde o toque numa notificação leva, conforme o papel de quem está
 * logado. Sem imports de app: é testado em Node.
 *
 * Contrato do chat: a tela `ChatAberto`/`MontadorChat` recebe `roomId` e o usa
 * em `GET /api/chat/:roomId`, cujo parâmetro é o **id do serviço** (a sala é
 * criada por serviço). O push traz também `chatRoomId`, que é o id da
 * `ChatRoom` — outro identificador. O popup usava `chatRoomId` como `roomId`
 * e abria a conversa com 404. Aqui `chatRoomId` nunca vira `roomId`.
 */
export const CHAT_TYPES = new Set<string>(["CHAT_NOVA_MENSAGEM", "MENSAGEM_RECEBIDA"]);

export type DadosNotificacao = {
  tipo: string;
  titulo?: string | null;
  servicoId?: string | null;
};

export function destinoDaNotificacao(
  n: DadosNotificacao,
  papel: string | null | undefined,
): [string, object?] | null {
  const montador = papel === "MONTADOR";
  const servicoId = typeof n.servicoId === "string" && n.servicoId ? n.servicoId : null;

  if (CHAT_TYPES.has(String(n.tipo))) {
    if (!servicoId) return null;
    return [
      montador ? "MontadorChat" : "ChatAberto",
      // O título de uma notificação de chat é o nome de quem mandou —
      // melhor cabeçalho do que o "Conversa" genérico.
      { roomId: servicoId, servicoId, nomeUsuario: n.titulo || "Conversa" },
    ];
  }

  if (servicoId) {
    if (montador) return ["MontadorDetalheSolicitacao", { servicoId }];
    if (papel === "DIARISTA") return ["DiaristaDetalhe", { servicoId }];
    return ["EmpregadorDetalhe", { servicoId }];
  }
  return null;
}
