import type { AppIconName } from "./AppIcon";

export type AssinaturaPlano = {
  plan: string;
  subscription: {
    plan: string;
    status: string;
    planId: string | null;
    name: string | null;
    interval: "month" | "year" | null;
    provider: string;
    storeProductId: string | null;
    expiresAt: string | null;
    canceledAt: string | null;
  } | null;
  usage?: { solicitacoesMes?: { used: number; limit: number | null } };
};

export function apresentacaoDoPlano(data: AssinaturaPlano | null): { nome: string; icone: AppIconName } | null {
  if (!data) return null;
  if (data.plan === "FREE") return { nome: "Gratuito", icone: "Sprout" };
  const sub = data.subscription;
  if (data.plan === "BASIC") return { nome: sub?.name ?? "Básico", icone: "Zap" };
  if (data.plan === "PREMIUM") {
    return { nome: sub?.name ?? "Pro", icone: sub?.interval === "year" ? "Gem" : sub?.interval === "month" ? "Crown" : "Sparkles" };
  }
  return null;
}

export function planoAtualDoCatalogo(data: AssinaturaPlano | null, id: string): boolean {
  return Boolean(data && data.plan !== "FREE" && data.subscription?.planId === id);
}


/** Trocas pela Google exigem replacement: só o fluxo Stripe já existente permite outro plano. */
export function bloqueiaNovaCompra(data: AssinaturaPlano | null, id: string, pelaLoja: boolean): boolean {
  if (!data) return true;
  if (data.plan === "FREE") return false;
  if (planoAtualDoCatalogo(data, id)) return true;
  return pelaLoja || data.subscription?.provider !== "STRIPE";
}
