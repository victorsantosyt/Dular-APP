import { requireAuthAtivo } from "@/lib/contaAtiva";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/apiResponse";
import { checkFeatureAccess } from "@/lib/featureGate";
import { assinaturaEfetiva, identidadeDoPlano } from "@/lib/assinatura";
import { sincronizarRenovacoesAtrasadas } from "@/lib/googlePlayCompras";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let payload;
  try {
    payload = await requireAuthAtivo(request);
  } catch {
    return fail("UNAUTHORIZED", "Não autenticado", 401);
  }

  // Renovação da loja vencida sem confirmação: relê a loja antes de responder.
  // Sem resposta, o plano não é concedido, mas também não é dado como expirado.
  let renovacaoPendente = false;
  try {
    renovacaoPendente = (await sincronizarRenovacoesAtrasadas({ userId: payload.userId }, 5)).pendente;
  } catch (err) {
    renovacaoPendente = true;
    console.error("[me/subscription] releitura da loja falhou:", (err as Error)?.message);
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
    // "pendente": há renovação na loja que ainda não foi confirmada. Não é
    // expiração; o app não deve oferecer nova compra enquanto isso.
    verificacaoLoja: renovacaoPendente ? "pendente" : null,
  });
}
