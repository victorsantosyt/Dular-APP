import { PLANS, type PlanId } from "@/lib/stripe";
import { OperacaoEmAndamento, pedirPlano } from "@/lib/trocaDePlano";
import type Stripe from "stripe";
import { requireAuth } from "@/lib/requireAuth";
import { requireAuthAtivo, respostaDeSessao } from "@/lib/contaAtiva";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/apiResponse";
import { cleanupRateLimit, rateLimit, rateLimitRetryAfterMs } from "@/lib/rateLimit";
import { getRequestIp } from "@/lib/requestIp";
import { z } from "zod";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.NEXTAUTH_URL ??
  process.env.AUTH_URL ??
  "http://localhost:3000";

// A lista sai do PRÓPRIO catálogo, não copiada à mão: escrita duas vezes, ela
// divergiu — os planos do montador entraram em `PLANS` e ninguém lembrou deste
// enum, então todo checkout de montador morria em "Dados inválidos" antes de
// chegar ao Stripe. Ele via os planos, tocava em Assinar e não ia a lugar
// nenhum. Derivando das chaves, um plano novo passa a valer sozinho.
const PLAN_IDS = Object.keys(PLANS) as [PlanId, ...PlanId[]];

const checkoutSchema = z.object({
  planId: z.enum(PLAN_IDS).optional(),
  plano: z.enum(["PLUS", "PREMIUM"]).optional(),
});

function legacyPlanoToPlanId(
  plano: "PLUS" | "PREMIUM" | undefined,
  role: string
): PlanId | null {
  if (!plano) return null;
  if (role === "DIARISTA") {
    return plano === "PLUS" ? "basico_mensal" : "pro_mensal";
  }
  // Estratégia oficial (00-fonte-unica-verdade.md): o Empregador NUNCA paga.
  // Qualquer checkout de Empregador cai aqui e retorna null → INVALID_PLAN.
  return null;
}

export async function POST(request: Request) {
  let payload;
  try {
    cleanupRateLimit();
    payload = await requireAuthAtivo(request);
  } catch {
    return fail("UNAUTHORIZED", "Não autenticado", 401);
  }

  const ip = getRequestIp(request);
  const rlIp = rateLimit({ key: `checkout-ip:${ip}`, limit: 30, windowMs: 10 * 60_000 });
  const rlUser = rateLimit({
    key: `checkout-user:${payload.userId}`,
    limit: 5,
    windowMs: 10 * 60_000,
  });
  if (!rlIp.ok || !rlUser.ok) {
    const resetAt = Math.max(!rlIp.ok ? rlIp.resetAt : 0, !rlUser.ok ? rlUser.resetAt : 0);
    return fail(
      "RATE_LIMITED",
      "Muitas tentativas. Aguarde um pouco e tente novamente.",
      429,
      { retryAfterMs: rateLimitRetryAfterMs(resetAt) },
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return fail("INVALID_BODY", "Dados inválidos", 400);
  }

  const planId =
    parsed.data.planId ??
    legacyPlanoToPlanId(parsed.data.plano, payload.role);

  if (!planId || !PLANS[planId]) {
    return fail("INVALID_PLAN", "Plano inválido", 400);
  }

  const plan = PLANS[planId];
  if (plan.role !== payload.role) {
    return fail("PLAN_ROLE_MISMATCH", "Plano indisponível para este perfil", 403);
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { email: true },
  });

  if (!user) {
    return fail("USER_NOT_FOUND", "Usuário não encontrado", 404);
  }

  const checkout: Stripe.Checkout.SessionCreateParams = {
    mode: plan.mode,
    line_items: [
      {
        price_data: {
          currency: "brl",
          unit_amount: plan.priceInCents,
          product_data: { name: plan.name, description: plan.description },
          recurring: { interval: plan.interval },
        },
        quantity: 1,
      },
    ],
    client_reference_id: payload.userId,
    customer_email: user.email ?? undefined,
    metadata: {
      userId: payload.userId,
      planId,
      subscriptionPlan: plan.plan,
    },
    // Os mesmos metadados na ASSINATURA: chegam na fatura em
    // `parent.subscription_details.metadata`, e o `invoice.paid` da compra —
    // que chega antes do `checkout.session.completed` — cria o vínculo por eles.
    subscription_data: {
      metadata: {
        userId: payload.userId,
        planId,
        subscriptionPlan: plan.plan,
      },
    },
    success_url: `${BASE_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${BASE_URL}/billing/cancel`,
  };

  // Quem já assina não ganha um segundo Checkout: a mesma assinatura é
  // alterada (lib/trocaDePlano). O app sempre recebe `url` para abrir — o
  // Checkout, a fatura da troca a pagar, ou a página de retorno ao app.
  let resultado;
  try {
    resultado = await pedirPlano({
      userId: payload.userId,
      role: payload.role,
      plano: plan,
      checkout,
      urlConcluida: `${BASE_URL}/billing/success`,
    });
  } catch (err) {
    if (err instanceof OperacaoEmAndamento) {
      return fail("OPERACAO_EM_ANDAMENTO", "Seu pedido anterior ainda está sendo processado. Tente novamente em instantes.", 409);
    }
    // A operação ficou gravada como pendente: o próximo pedido a retoma sem cobrar de novo.
    console.error("[billing/checkout] falha ao processar o pedido de plano:", err);
    return fail("TENTE_NOVAMENTE", "Não foi possível concluir agora. Tente novamente em instantes.", 503);
  }

  if (resultado.tipo === "recusado") return fail(resultado.codigo, resultado.mensagem, resultado.status);
  if (resultado.tipo === "checkout") return ok({ checkoutUrl: resultado.url, url: resultado.url });
  return ok({
    checkoutUrl: resultado.url,
    url: resultado.url,
    troca: { situacao: resultado.situacao, planId, vigenteEm: resultado.vigenteEm ?? null },
  });
}
