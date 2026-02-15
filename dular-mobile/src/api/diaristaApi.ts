import { api } from "../lib/api";

export type HabilidadePayload = { tipo: string; categoria?: string | null };

export async function getHabilidades() {
  const res = await api.get("/api/diarista/habilidades");
  return res.data?.habilidades ?? res.data;
}

export async function putHabilidades(habilidades: HabilidadePayload[]) {
  const res = await api.put("/api/diarista/habilidades", { habilidades });
  return res.data?.habilidades ?? res.data;
}
