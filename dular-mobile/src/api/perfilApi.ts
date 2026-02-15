import { api } from "../lib/api";

export type VerificacaoStatus = "NAO_ENVIADO" | "PENDENTE" | "APROVADO" | "REPROVADO";

export type VerificacaoInfo = {
  status: VerificacaoStatus;
  updatedAt?: string;
  motivo?: string | null;
};

export type Me = {
  id: string;
  nome?: string;
  telefone?: string;
  email?: string | null;
  role?: "CLIENTE" | "DIARISTA" | "ADMIN";
  bio?: string | null;
  avatarUrl?: string | null;
  bairros?: string[];
  disponibilidade?: any;
  precos?: any;
  verificado?: boolean;
  verificacao?: VerificacaoInfo;
};

export async function getMe(): Promise<Me> {
  const res = await api.get("/api/me");
  return res.data?.user ?? res.data;
}

export async function updateMe(payload: { nome?: string; email?: string; senhaAtual?: string; novaSenha?: string }): Promise<Me> {
  const res = await api.put("/api/me", payload);
  return res.data?.user ?? res.data;
}

export async function changePassword(payload: { senhaAtual: string; novaSenha: string }) {
  const res = await api.put("/api/me", payload);
  return res.data;
}

export async function getDiaristaMe() {
  const res = await api.get("/api/diarista/me");
  return res.data?.profile ?? res.data;
}

export async function updateDiaristaBairros(payload: { cidade: string; uf: string; bairros: string[] }) {
  const res = await api.put("/api/diarista/bairros", payload);
  return res.data;
}

export async function updateDiaristaDisponibilidade(payload: any) {
  const res = await api.put("/api/diarista/disponibilidade", payload);
  return res.data;
}

export async function updateDiaristaPrecos(payload: { precoLeve: number; precoPesada: number; bio?: string }) {
  const res = await api.put("/api/diarista/precos", payload);
  return res.data;
}

export async function uploadAvatarDataUrl(dataUrl: string) {
  const res = await api.post("/api/me/avatar", { dataUrl });
  return res.data; // { ok, user }
}
