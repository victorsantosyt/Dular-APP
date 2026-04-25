import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

export type PlanId = "basico_mensal" | "pro_mensal" | "pro_anual" | "cliente_mensal";

export type PlanDef = {
  id: PlanId;
  name: string;
  description: string;
  role: "CLIENTE" | "DIARISTA";
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
  // ── CLIENTE ───────────────────────────────────────────────────────────────
  cliente_mensal: {
    id: "cliente_mensal",
    name: "Cliente Mensal",
    description: "Solicite serviços ilimitados por mês",
    role: "CLIENTE",
    mode: "subscription",
    interval: "month",
    priceInCents: 1490, // R$14,90
    plan: "PREMIUM",
  },
};
