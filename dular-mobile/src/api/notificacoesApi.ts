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
  verificacao: { relacao: RelacaoDoAviso; decisaoDoAviso: "APROVADO" | "REPROVADO" | "REENVIO" | null } | null;
};

/** GET /api/notificacoes/:id/contexto — o servidor responde 404 para aviso de outra conta. */
export async function obterContextoNotificacao(id: string, signal?: AbortSignal): Promise<ContextoNotificacao> {
  const res = await api.get<ContextoNotificacao & { ok?: boolean }>(
    `/api/notificacoes/${encodeURIComponent(id)}/contexto`,
    signal ? { signal } : undefined,
  );
  return { notificacao: res.data.notificacao, verificacao: res.data.verificacao ?? null };
}
