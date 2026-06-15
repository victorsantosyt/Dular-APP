import { api } from "@/lib/api";

/**
 * segurancaApi — chamadas do fluxo de segurança compartilhado pelos 3 perfis.
 *
 * O endpoint POST /api/seguranca/sos registra um SafetyEvent (SOS_SILENT) para
 * o usuário autenticado. `servicoId` é opcional: o fluxo de SOS do perfil não
 * está atrelado a um serviço específico, então pode ser omitido. O backend
 * limita `mensagem` a 500 caracteres e responde apenas { ok: true } — não
 * devolve número de protocolo.
 */
export type AcionarSosPayload = {
  servicoId?: string;
  mensagem?: string;
  /** Rótulo do tipo de incidente — guardado em meta para o acompanhamento. */
  tipo?: string;
  /** Prioridade (Baixa/Média/Alta/Crítica) — guardada em meta. */
  prioridade?: string;
  latitude?: number;
  longitude?: number;
};

export async function acionarSos(payload: AcionarSosPayload = {}): Promise<{ ok?: boolean; id?: string }> {
  const res = await api.post("/api/seguranca/sos", payload);
  return res.data ?? {};
}

/** Protocolo legível derivado do id do SafetyEvent (mesma fórmula em todas as telas). */
export function protocoloFromId(id?: string | null): string {
  if (!id) return "#SOS";
  return `#SOS-${id.slice(-6).toUpperCase()}`;
}

export type SafetyEventTipo = "SOS_SILENT" | "CHECKIN_OK";

export type SafetyEvent = {
  id: string;
  type: SafetyEventTipo;
  serviceId: string | null;
  createdAt: string;
  meta?: { mensagem?: string; tipo?: string; prioridade?: string } | null;
};

/** Lista os eventos de segurança do usuário (SOS/check-in), mais recentes primeiro. */
export async function listarEventosSeguranca(
  type?: SafetyEventTipo,
  limit = 20,
): Promise<SafetyEvent[]> {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  params.set("limit", String(limit));
  const res = await api.get(`/api/seguranca/eventos?${params.toString()}`);
  return Array.isArray(res.data?.eventos) ? res.data.eventos : [];
}
