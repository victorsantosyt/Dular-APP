import { prisma } from "@/lib/prisma";

export async function recomputeRiskForUser(userId: string) {
  const incidents = await prisma.incidentReport.findMany({
    where: { reportedUserId: userId },
    select: { status: true },
  });

  const confirmed = incidents.filter((i) => i.status === "CONFIRMADO").length;
  const open = incidents.filter((i) => i.status === "ABERTO").length;
  let score = 0;
  score += confirmed * 40;
  score += open * 20;

  let tier = 0;
  if (score >= 80) tier = 3;
  else if (score >= 50) tier = 2;
  else if (score >= 20) tier = 1;

  await prisma.user.update({
    where: { id: userId },
    data: { riskScore: score, riskTier: tier },
  });
}
