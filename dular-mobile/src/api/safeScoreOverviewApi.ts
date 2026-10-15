import { api } from "@/lib/api";
import type { SafeScoreTier } from "./safeScoreApi";

export type SafeScoreOverview = {
  status: string | null;
  mensagem: string;
  restrito: boolean;
  reputation: null | { faixa: string; tier: SafeScoreTier; nivel: string; status: string; mensagem: string; bloqueado: boolean; restrito: boolean };
  totalServicos: number;
  identidade: "VERIFICADO" | "PENDENTE" | "REPROVADO" | "NAO_ENVIADO";
  guide: { title: string; text: string }[];
};

export async function getSafeScoreOverview(): Promise<SafeScoreOverview> {
  const { data } = await api.get("/api/me/safescore");
  if (!data || !(data.status === null || typeof data.status === "string") ||
    typeof data.mensagem !== "string" || typeof data.restrito !== "boolean" || !Number.isInteger(data.totalServicos) || data.totalServicos < 0 ||
    !["VERIFICADO", "PENDENTE", "REPROVADO", "NAO_ENVIADO"].includes(data.identidade) ||
    !Array.isArray(data.guide) || !data.guide.length ||
    !data.guide.every((block: { title?: unknown; text?: unknown }) => typeof block?.title === "string" && typeof block.text === "string") ||
    (data.reputation !== null && (!data.reputation ||
      !["BRONZE", "SILVER", "GOLD", "PLATINUM"].includes(data.reputation.tier) ||
      !["faixa", "nivel", "status", "mensagem"].every(key => typeof data.reputation[key] === "string") ||
      typeof data.reputation.bloqueado !== "boolean" || typeof data.reputation.restrito !== "boolean"))) {
    throw new Error("Dados do SafeScore indisponíveis.");
  }
  return data;
}
