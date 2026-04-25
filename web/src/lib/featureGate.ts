import { prisma } from "@/lib/prisma";
import type { FeatureKey } from "@prisma/client";

export type { FeatureKey };

export type FeatureAccess = {
  allowed: boolean;
  limit: number | null;
  used: number;
  plan: string;
};

export async function checkFeatureAccess(
  userId: string,
  feature: FeatureKey
): Promise<FeatureAccess> {
  // 1. Subscription + role em paralelo
  const [subscription, user] = await Promise.all([
    prisma.subscription.findUnique({
      where: { userId },
      select: { plan: true, status: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    }),
  ]);

  // ACTIVE e TRIAL são planos válidos; CANCELED/EXPIRED caem para FREE
  const isActive =
    subscription?.status === "ACTIVE" || subscription?.status === "TRIAL";
  const plan = isActive && subscription ? subscription.plan : "FREE";

  // 2. Limite definido para esse plano + feature
  const featureLimit = await prisma.featureLimit.findUnique({
    where: { plan_feature: { plan, feature } },
    select: { limit: true, enabled: true },
  });

  // Sem registro de limite → libera sem restrição
  if (!featureLimit) {
    return { allowed: true, limit: null, used: 0, plan };
  }

  if (!featureLimit.enabled) {
    return { allowed: false, limit: featureLimit.limit ?? null, used: 0, plan };
  }

  // 3. Para SOLICITACOES_MES, conta serviços ativos no mês corrente
  let used = 0;
  if (feature === "SOLICITACOES_MES") {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const role = user?.role;

    used = await prisma.servico.count({
      where: {
        ...(role === "DIARISTA"
          ? { diaristaId: userId }
          : { clientId: userId }),
        status: { notIn: ["CANCELADO", "RECUSADO", "RASCUNHO"] },
        createdAt: { gte: startOfMonth, lt: startOfNextMonth },
      },
    });
  }

  // 4. limit null = ilimitado → sempre permitido
  const allowed = featureLimit.limit === null || used < featureLimit.limit;

  return {
    allowed,
    limit: featureLimit.limit ?? null,
    used,
    plan,
  };
}
