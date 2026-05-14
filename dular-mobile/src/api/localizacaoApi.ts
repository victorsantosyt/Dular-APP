import { api } from "@/lib/api";

export type RegiaoAtualPayload = {
  latitude?: number | null;
  longitude?: number | null;
  cidade: string;
  estado: string;
  bairro?: string | null;
  localizacaoPermitida: boolean;
};

export type RegiaoAtualResponse = {
  ok: boolean;
  role?: string;
  localizacao?: {
    latitude?: number | null;
    longitude?: number | null;
    cidadeAtual?: string | null;
    estadoAtual?: string | null;
    bairroAtual?: string | null;
    localizacaoPermitida?: boolean;
    localizacaoAtualizadaEm?: string | null;
  };
  error?: string;
};

export async function salvarLocalizacaoAtual(payload: RegiaoAtualPayload) {
  const res = await api.patch<RegiaoAtualResponse>("/api/me/localizacao", payload);
  return res.data;
}
