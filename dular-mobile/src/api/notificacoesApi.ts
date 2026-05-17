import { api } from "@/lib/api";

export type NotificacaoTipo =
  | "SERVICO_SOLICITADO"
  | "SERVICO_ACEITO"
  | "SERVICO_RECUSADO"
  | "SERVICO_INICIADO"
  | "SERVICO_FINALIZADO"
  | "SERVICO_CANCELADO"
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
  notificacoes?: Notificacao[];
  items?: Notificacao[];
};

export async function listarNotificacoes(): Promise<Notificacao[]> {
  const res = await api.get<ListResponse>("/api/notificacoes");
  const list = res.data?.notificacoes ?? res.data?.items ?? [];
  return Array.isArray(list) ? list : [];
}

export async function marcarComoLida(id: string): Promise<void> {
  await api.patch(`/api/notificacoes/${id}/ler`);
}

export async function marcarTodasComoLidas(): Promise<void> {
  await api.patch("/api/notificacoes/ler-todas");
}
