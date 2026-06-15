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
  latitude?: number;
  longitude?: number;
};

export async function acionarSos(payload: AcionarSosPayload = {}) {
  const res = await api.post("/api/seguranca/sos", payload);
  return res.data;
}
