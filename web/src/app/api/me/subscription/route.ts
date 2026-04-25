import { requireAuth } from "@/lib/requireAuth";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/apiResponse";
import { checkFeatureAccess } from "@/lib/featureGate";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let payload;
  try {
    payload = requireAuth(request);
  } catch {
    return fail("UNAUTHORIZED", "Não autenticado", 401);
  }

  const [subscription, solicitacoes] = await Promise.all([
    prisma.subscription.findUnique({
      where: { userId: payload.userId },
      select: {
        plan: true,
        status: true,
        startedAt: true,
        expiresAt: true,
        canceledAt: true,
      },
    }),
    checkFeatureAccess(payload.userId, "SOLICITACOES_MES"),
  ]);

  return ok({
    subscription: subscription
      ? {
          plan: subscription.plan,
          status: subscription.status,
          startedAt: subscription.startedAt,
          expiresAt: subscription.expiresAt,
          canceledAt: subscription.canceledAt,
        }
      : null,
    plan: solicitacoes.plan,
    usage: {
      solicitacoesMes: {
        used: solicitacoes.used,
        limit: solicitacoes.limit,
        allowed: solicitacoes.allowed,
      },
    },
  });
}
