import { prisma } from "@/lib/prisma";
import { RiskBand } from "@prisma/client";

/**
 * Faixa de risco a partir do riskScore. Mesmos cortes de antes (80/50/20);
 * o que muda é o destino: antes isto era gravado em `riskTier` como
 * SafeScoreTier, e "mais risco" virava PLATINUM — o tier de MAIOR confiança,
 * no mesmo campo que applyEvent.ts escreve com o sentido certo. Quem gravasse
 * por último decidia o que o campo significava.
 */
export function riskBandFromScore(riskScore: number): RiskBand {
  if (riskScore >= 80) return RiskBand.CRITICO;
  if (riskScore >= 50) return RiskBand.ALTO;
  if (riskScore >= 20) return RiskBand.MEDIO;
  return RiskBand.BAIXO;
}

/** Escreve SOMENTE riskScore e riskBand. `riskTier` pertence a applyEvent.ts. */
export async function recomputeRiskForUser(userId: string) {
  const incidents = await prisma.incidentReport.findMany({
    where: { reportedUserId: userId },
    select: { status: true },
  });

  const confirmed = incidents.filter((i) => i.status === "CONFIRMADO").length;
  const open = incidents.filter((i) => i.status === "ABERTO").length;

  let riskScore = 0;
  riskScore += confirmed * 40;
  riskScore += open * 20;

  await prisma.user.update({
    where: { id: userId },
    data: { riskScore, riskBand: riskBandFromScore(riskScore) },
  });
}
