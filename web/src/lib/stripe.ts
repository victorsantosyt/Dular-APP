import Stripe from "stripe";

// Inicialização LAZY: construir o client no import quebrava o `next build`
// (o "collect page data" avalia as rotas sem env de runtime e o SDK lança
// "Neither apiKey nor config.authenticator provided" sem a key). Billing é
// inerte no Beta — STRIPE_* pode legitimamente não existir no ambiente.
let stripeSingleton: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeSingleton) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    stripeSingleton = new Stripe(key, {
      apiVersion: "2026-06-24.dahlia",
    });
  }
  return stripeSingleton;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const client = getStripe();
    const value = Reflect.get(client, prop, client);
    // Métodos precisam de `this` = client real (não o Proxy).
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export type PlanId = "basico_mensal" | "pro_mensal" | "pro_anual";

export type PlanDef = {
  id: PlanId;
  name: string;
  description: string;
  // Estratégia oficial (00-fonte-unica-verdade.md): somente o profissional paga.
  // O Empregador NUNCA paga — não há plano com role "EMPREGADOR".
  role: "DIARISTA" | "MONTADOR";
  mode: "subscription";
  interval: "month" | "year";
  priceInCents: number;
  plan: "BASIC" | "PREMIUM";
};

export const PLANS: Record<PlanId, PlanDef> = {
  // ── DIARISTA ──────────────────────────────────────────────────────────────
  basico_mensal: {
    id: "basico_mensal",
    name: "Básico Mensal",
    description: "Até 10 serviços por mês",
    role: "DIARISTA",
    mode: "subscription",
    interval: "month",
    priceInCents: 1990, // R$19,90
    plan: "BASIC",
  },
  pro_mensal: {
    id: "pro_mensal",
    name: "Pro Mensal",
    description: "Serviços ilimitados por mês",
    role: "DIARISTA",
    mode: "subscription",
    interval: "month",
    priceInCents: 3990, // R$39,90
    plan: "PREMIUM",
  },
  pro_anual: {
    id: "pro_anual",
    name: "Pro Anual",
    description: "Serviços ilimitados por 1 ano",
    role: "DIARISTA",
    mode: "subscription",
    interval: "year",
    priceInCents: 35900, // R$359,00
    plan: "PREMIUM",
  },
};
