import type { ProfileTheme } from "@/theme/profileTheme";
import type { SafeScoreOverview } from "@/api/safeScoreOverviewApi";

export type SafeScoreEmblemState = "unavailable" | "restricted" | "observation" | "verified" | "neutral";

export function getSafeScoreEmblemState(data: SafeScoreOverview | null): SafeScoreEmblemState {
  if (data?.restrito || data?.reputation?.bloqueado) return "restricted";
  if (!data?.reputation) return "unavailable";
  if (data.status === "Em Observação") return "observation";
  return data.identidade === "VERIFICADO" ? "verified" : "neutral";
}

export const IDENTITY_LABELS: Record<SafeScoreOverview["identidade"], string> = {
  VERIFICADO: "Verificada",
  PENDENTE: "Pendente",
  REPROVADO: "Reprovada",
  NAO_ENVIADO: "Não enviada",
};

export function getSafeScoreBackground(theme: ProfileTheme): string {
  const blend = (offset: number) => Math.round(
    parseInt(theme.background.slice(offset, offset + 2), 16) * 0.6 +
    parseInt(theme.primarySoft.slice(offset, offset + 2), 16) * 0.4,
  ).toString(16).padStart(2, "0");
  return `#${blend(1)}${blend(3)}${blend(5)}`;
}
