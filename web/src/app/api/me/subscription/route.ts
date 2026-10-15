import { requireAuthAtivo } from "@/lib/contaAtiva";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/apiResponse";
import { checkFeatureAccess } from "@/lib/featureGate";
import { assinaturaEfetiva, identidadeDoPlano } from "@/lib/assinatura";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let payload;
  try {
    payload = await requireAuthAtivo(request);
  } catch {
    return fail("UNAUTHORIZED", "Não autenticado", 401);
  }

  // A assinatura mostrada é a que dá o plano (vínculo Stripe ou compra de loja).
  const [{ registro: subscription }, solicitacoes, usuario] = await Promise.all([
    assinaturaEfetiva(payload.userId),
    checkFeatureAccess(payload.userId, "SOLICITACOES_MES"),
    prisma.user.findUnique({
      where: { id: payload.userId },
      select: { premiumIntroShownAt: true },
    }),
  ]);

  return ok({
    subscription: subscription
      ? {
          ...identidadeDoPlano(subscription),
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
    // Só LEITURA: quem decide se a apresentação aparece é o POST claim-intro,
    // que marca e responde no mesmo passo. Este campo existe para telas que
    // queiram saber o estado sem reivindicar nada — ler não pode consumir a
    // única exibição a que a conta tem direito.
    premiumIntroShown: usuario?.premiumIntroShownAt != null,
  });
}
