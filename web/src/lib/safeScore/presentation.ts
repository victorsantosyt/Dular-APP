import { prisma } from "@/lib/prisma";
import { getFaixa } from "@/lib/safeScore";
import { scoreToTier } from "./applyEvent";

// Níveis, faixas e guia: fonte única compartilhada com o app (shared/safescore/guia.ts).
import { SAFE_SCORE_GUIDE, TIER_LABELS } from "../../../../shared/safescore/guia";

export { SAFE_SCORE_GUIDE, TIER_LABELS };

export async function readScorePresentation(userId: string) {
  const profile = await prisma.safeScoreProfile.findUnique({
    where: { userId }, select: { currentScore: true },
  });
  const legacy = profile ? null : await prisma.safeScore.findUnique({
    where: { userId }, select: { score: true },
  });
  const score = profile?.currentScore ?? legacy?.score;
  if (score == null) return null;
  const faixa = getFaixa(score);
  const tier = scoreToTier(score);
  return { faixa: faixa.label, cor: faixa.cor, bloqueado: faixa.bloqueado, tier, nivel: TIER_LABELS[tier] };
}

export function countCompletedServices(userId: string) {
  return prisma.servico.count({ where: {
    status: { in: ["CONFIRMADO", "FINALIZADO"] },
    OR: [{ clientId: userId }, { diaristaId: userId }, { montadorId: userId }],
  } });
}

export async function canReadScore(
  viewer: { userId: string; role: string },
  alvo: { id: string; role: string | null },
): Promise<boolean> {
  if (viewer.userId === alvo.id) return true;
  if (viewer.role === "ADMIN") return true;
  if (alvo.role === "DIARISTA" || alvo.role === "MONTADOR") return true;

  const vinculo = await prisma.servico.findFirst({
    where: {
      clientId: alvo.id,
      OR: [{ diaristaId: viewer.userId }, { montadorId: viewer.userId }],
    },
    select: { id: true },
  });
  return vinculo !== null;
}
