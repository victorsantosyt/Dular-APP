import { prisma } from "@/lib/prisma";
import { SafeScoreTier } from "@prisma/client";

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

  let riskTier: SafeScoreTier;
  if (riskScore >= 80) riskTier = SafeScoreTier.PLATINUM;
  else if (riskScore >= 50) riskTier = SafeScoreTier.GOLD;
  else if (riskScore >= 20) riskTier = SafeScoreTier.SILVER;
  else riskTier = SafeScoreTier.BRONZE;

  await prisma.user.update({
    where: { id: userId },
    data: { riskScore, riskTier },
  });
}
