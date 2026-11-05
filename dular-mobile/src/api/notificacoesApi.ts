import { api } from "@/lib/api";

export type NotificacaoTipo =
  | "SERVICO_SOLICITADO"
  | "SERVICO_ACEITO"
  | "SERVICO_RECUSADO"
  | "SERVICO_INICIADO"
  | "SERVICO_FINALIZADO"
  | "SERVICO_CANCELADO"
  | "CHAT_NOVA_MENSAGEM"
  | "MENSAGEM_RECEBIDA"
  | "AVALIACAO_RECEBIDA"
  | "ALERTA_SEGURANCA"
  | "SISTEMA"
  | "NOVIDADE";

export type Notificacao = {
  id: string;
  type: NotificacaoTipo | string;
  title: string;
  body: string;
  servicoId?: string | null;
  chatRoomId?: string | null;
  readAt?: string | null;
  createdAt: string;
};

type ListResponse = {
  ok?: boolean;
  // O backend (GET /api/notificacoes) responde com a chave `notifications`.
  // Mantemos `notificacoes`/`items` como fallback defensivo para qualquer
  // versão antiga do backend, mas `notifications` é o contrato atual.
  notifications?: Notificacao[];
  notificacoes?: Notificacao[];
  items?: Notificacao[];
};

/**
 * Tipos de notificação que pertencem ao chat. Elas NÃO aparecem na tela/contagem
 * de Notificações — o não-lido de mensagens é sinalizado só em Mensagens (badge
 * da aba e do card da conversa), no modelo WhatsApp.
 */
const CHAT_NOTIFICACAO_TYPES = new Set<string>(["CHAT_NOVA_MENSAGEM", "MENSAGEM_RECEBIDA"]);

export async function listarNotificacoes(signal?: AbortSignal): Promise<Notificacao[]> {
  const res = await api.get<ListResponse>("/api/notificacoes", signal ? { signal } : undefined);
  const list =
    res.data?.notifications ??
    res.data?.notificacoes ??
    res.data?.items ??
    [];
  if (!Array.isArray(list)) return [];
  // Notificações de chat são tratadas só na aba Mensagens.
  return list.filter((n) => !CHAT_NOTIFICACAO_TYPES.has(String(n.type)));
}

export async function marcarComoLida(id: string): Promise<void> {
  await api.patch(`/api/notificacoes/${id}/ler`);
}

export async function marcarTodasComoLidas(): Promise<void> {
  await api.patch("/api/notificacoes/ler-todas");
}

export type RelacaoDoAviso = "VIGENTE" | "SUPERADA" | "ENVIO_ANTERIOR" | "INDETERMINADA";

export type ContextoNotificacao = {
  notificacao: { id: string; type: string; createdAt: string; lida: boolean };
  /** Só para avisos de verificação: se a decisão do aviso ainda vale. */
  verificacao: {
    relacao: RelacaoDoAviso;
    /** EXPLICITO: aviso novo, ligado ao envio/decisão. SEM_VINCULO: aviso antigo; relação só pelo tempo. */
    vinculo?: "EXPLICITO" | "SEM_VINCULO";
    decisaoDoAviso: "APROVADO" | "REPROVADO" | "REENVIO" | null;
  } | null;
};

/** GET /api/notificacoes/:id/contexto — o servidor responde 404 para aviso de outra conta. */
export async function obterContextoNotificacao(id: string, signal?: AbortSignal): Promise<ContextoNotificacao> {
  const res = await api.get<ContextoNotificacao & { ok?: boolean }>(
    `/api/notificacoes/${encodeURIComponent(id)}/contexto`,
    signal ? { signal } : undefined,
  );
  return { notificacao: res.data.notificacao, verificacao: res.data.verificacao ?? null };
}

// ── Cards (GET /api/notificacoes/cards) ─────────────────────────────────────

export type EstadoAcionavel = "ACAO_NECESSARIA" | "EM_ANALISE" | "RESOLVIDO" | "SUPERADO" | "AVISO_ANTERIOR";
export type FiltroCards = "todas" | "nao_lidas" | "lidas";

export type CardNotificacao = {
  id: string;
  tipo: "VERIFICACAO" | "SIMPLES";
  /** Evento original mostrado no card: texto, data e leitura como foram gravados. */
  principal: { id: string; type: string; title: string; body: string; servicoId: string | null; createdAt: string; readAt: string | null };
  /** Quantos eventos o card agrupa (o principal + os do histórico). */
  eventos: number;
  naoLidos: number;
  verificacaoId: string | null;
  /** Estado ATUAL calculado no servidor. Nulo em mensagens, serviços e avisos informativos. */
  apresentacao: {
    estado: EstadoAcionavel;
    rotulo: string;
    titulo: string;
    motivo: string | null;
    acao: "REENVIAR" | "ACOMPANHAR" | "VER_CONTEXTO";
    estadoAtualizadoEm: string | null;
  } | null;
};

export type PaginaDeCards = {
  filtro: FiltroCards;
  cards: CardNotificacao[];
  proximoCursor: string | null;
  contadores: { naoLidas: number; acoesNecessarias: number; cards: Record<FiltroCards, number> };
};

export async function listarCards(p: { filtro: FiltroCards; cursor?: string | null; limite?: number }, signal?: AbortSignal): Promise<PaginaDeCards> {
  const params = new URLSearchParams({ filtro: p.filtro, limite: String(p.limite ?? 30) });
  if (p.cursor) params.set("cursor", p.cursor);
  const res = await api.get<PaginaDeCards & { ok?: boolean }>(`/api/notificacoes/cards?${params.toString()}`, signal ? { signal } : undefined);
  return { filtro: res.data.filtro, cards: res.data.cards ?? [], proximoCursor: res.data.proximoCursor ?? null, contadores: res.data.contadores };
}

export type HistoricoVerificacao = {
  envios: Array<{
    id: string;
    atual: boolean;
    enviadoEm: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    decisoes: Array<{ id: string; decisao: string; em: string; avisos: Array<{ id: string; title: string; body: string; createdAt: string; readAt: string | null }> }>;
  }>;
  semVinculo: Array<{ id: string; title: string; body: string; createdAt: string; readAt: string | null }>;
};

export async function obterHistoricoVerificacao(signal?: AbortSignal): Promise<HistoricoVerificacao> {
  const res = await api.get<HistoricoVerificacao>("/api/notificacoes/historico-verificacao", signal ? { signal } : undefined);
  return { envios: res.data.envios ?? [], semVinculo: res.data.semVinculo ?? [] };
}

/** Marca como lidas SÓ as notificações mostradas (o servidor ignora ids de outra conta). */
export async function marcarLidasEmLote(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await api.patch("/api/notificacoes/ler-lote", { ids: ids.slice(0, 100) });
}
