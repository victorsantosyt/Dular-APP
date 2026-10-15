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

/** O catálogo é uma ação explícita de quem já tem acesso pago confirmado. */
export function exibicaoDosPlanos(data: AssinaturaPlano | null, upgrade: boolean): "consulta" | "resumo" | "catalogo" {
  if (!data) return "consulta";
  return data.plan !== "FREE" && !upgrade ? "resumo" : "catalogo";
}

export function alternativasDoPlano<T extends { id: string }>(data: AssinaturaPlano | null, planos: T[]): T[] {
  return planos.filter((plano) => !planoAtualDoCatalogo(data, plano.id));
}

export function gerenciaAssinaturaNaGoogle(data: AssinaturaPlano | null): boolean {
  return Boolean(data && data.plan !== "FREE" && data.subscription?.provider === "GOOGLE");
}

export function podeFazerUpgradeGoogle(data: AssinaturaPlano | null, alvo: { id: string; plan: string; interval: string | null }): boolean {
  if (!gerenciaAssinaturaNaGoogle(data) || planoAtualDoCatalogo(data, alvo.id)) return false;
  if (data?.subscription?.status !== "ACTIVE" || data.subscription.canceledAt) return false;
  if (alvo.plan !== "PREMIUM" || (alvo.interval !== "month" && alvo.interval !== "year")) return false;
  return data.plan === "BASIC" || (data.plan === "PREMIUM" && data.subscription.interval === "month" && alvo.interval === "year");
}

export function estadoDoPlano(data: AssinaturaPlano): string {
  if (data.subscription?.canceledAt) return "Renovação cancelada. Você mantém os benefícios até o fim do período.";
  if (data.subscription?.status === "ACTIVE") return "Assinatura ativa";
  if (data.subscription?.status === "PAST_DUE") return "Pagamento pendente. Confira sua assinatura na loja.";
  return "Confira o estado da sua assinatura na loja.";
}


/** Trocas pela Google exigem replacement: só o fluxo Stripe já existente permite outro plano. */
export function bloqueiaNovaCompra(data: AssinaturaPlano | null, id: string, pelaLoja: boolean): boolean {
  if (!data) return true;
  if (data.plan === "FREE") return false;
  if (planoAtualDoCatalogo(data, id)) return true;
  return pelaLoja || data.subscription?.provider !== "STRIPE";
}

