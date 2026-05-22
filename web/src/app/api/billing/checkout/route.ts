import { stripe, PLANS, type PlanId } from "@/lib/stripe";
import { requireAuth } from "@/lib/requireAuth";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/apiResponse";
import { z } from "zod";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.NEXTAUTH_URL ??
  process.env.AUTH_URL ??
  "http://localhost:3000";

const checkoutSchema = z.object({
  planId: z.enum(["basico_mensal", "pro_mensal", "pro_anual", "cliente_mensal"]).optional(),
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
  if (role === "EMPREGADOR") {
    return "cliente_mensal";
  }
  return null;
}

export async function POST(request: Request) {
  let payload;
  try {
    payload = requireAuth(request);
  } catch {
    return fail("UNAUTHORIZED", "Não autenticado", 401);
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

  const session = await stripe.checkout.sessions.create({
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
    success_url: `${BASE_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${BASE_URL}/billing/cancel`,
  });

  return ok({ checkoutUrl: session.url, url: session.url });
}
