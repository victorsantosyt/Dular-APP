/**
 * Para onde o toque numa notificação leva, conforme o papel de quem está
 * logado. Sem imports de app: é testado em Node.
 *
 * O destino sai SEMPRE desta tabela, pelo tipo da notificação e pelo papel da
 * sessão. Nenhum nome de rota vem do payload (push ou lista): um campo de rota
 * vindo do servidor ou de um push forjado não leva a tela nenhuma.
 *
 * Contrato do chat: a tela `ChatAberto`/`MontadorChat` recebe `roomId` e o usa
 * em `GET /api/chat/:roomId`, cujo parâmetro é o **id do serviço** (a sala é
 * criada por serviço). O push traz também `chatRoomId`, que é o id da
 * `ChatRoom` — outro identificador. O popup usava `chatRoomId` como `roomId`
 * e abria a conversa com 404. Aqui `chatRoomId` nunca vira `roomId`.
 */
export const CHAT_TYPES = new Set<string>(["CHAT_NOVA_MENSAGEM", "MENSAGEM_RECEBIDA"]);

/** Decisões de verificação: abrem a tela de Verificação, que relê o estado atual. */
export const TIPOS_VERIFICACAO = new Set<string>(["VERIFICACAO_APROVADA", "VERIFICACAO_REPROVADA"]);

export type DadosNotificacao = {
  tipo: string;
  titulo?: string | null;
  servicoId?: string | null;
  /** Id da Notification no backend (lista: `id`; push: `notificationId`). */
  id?: string | null;
};

export type DestinoNotificacao =
  | ["VerificacaoDocs", { notificacaoId?: string }]
  | ["ChatAberto" | "MontadorChat", { roomId: string; servicoId: string; nomeUsuario: string }]
  | ["MontadorDetalheSolicitacao" | "DiaristaDetalhe" | "EmpregadorDetalhe", { servicoId: string }]
  | ["MontadorTabs", { screen: "MontadorSolicitacoes" }];

function texto(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

export function destinoDaNotificacao(
  n: DadosNotificacao,
  papel: string | null | undefined,
): DestinoNotificacao | null {
  if (papel !== "MONTADOR" && papel !== "DIARISTA" && papel !== "EMPREGADOR") return null;
  const montador = papel === "MONTADOR";
  const tipo = String(n.tipo);
  const servicoId = texto(n.servicoId);

  if (TIPOS_VERIFICACAO.has(tipo)) {
    const notificacaoId = texto(n.id);
    return ["VerificacaoDocs", notificacaoId ? { notificacaoId } : {}];
  }

  if (CHAT_TYPES.has(tipo)) {
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

  // Pedido novo sem serviço no payload: a aba de solicitações do montador fica
  // dentro do navegador de abas — navegar pelo nome puro, da raiz, falhava em
  // silêncio.
  if (montador && tipo === "NOVA_SOLICITACAO") return ["MontadorTabs", { screen: "MontadorSolicitacoes" }];
  return null;
}
