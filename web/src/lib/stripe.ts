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

export type PlanId =
  | "basico_mensal"
  | "pro_mensal"
  | "pro_anual"
  | "montador_basico_mensal"
  | "montador_pro_mensal"
  | "montador_pro_anual";

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
  /**
   * Id do produto nas lojas. A App Store e o Google Play exigem compra in-app
   * para assinatura que desbloqueia função dentro do app (diretriz 3.1.1 da
   * Apple) — o checkout do Stripe segue valendo na web.
   *
   * O mesmo id nas duas lojas de propósito: um id por plano é menos coisa para
   * errar do que dois, e nada impede que sejam iguais.
   *
   * Ainda NÃO existem no App Store Connect nem no Play Console. Estão aqui para
   * a lógica ficar pronta: cadastrar os produtos com estes ids é o que falta,
   * e nada no código muda depois disso.
   */
  storeProductId: string;
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
    storeProductId: "br.com.dular.diarista.basico.mensal",
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
    storeProductId: "br.com.dular.diarista.pro.mensal",
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
    storeProductId: "br.com.dular.diarista.pro.anual",
  },

  // ── MONTADOR ──────────────────────────────────────────────────────────────
  // Mesmos valores e critérios da diarista, por decisão do dono. Os limites
  // não são declarados aqui: vêm de FeatureLimit por `plan` (BASIC/PREMIUM),
  // que já vale para os dois papéis.
  montador_basico_mensal: {
    id: "montador_basico_mensal",
    name: "Básico Mensal",
    description: "Até 10 serviços por mês",
    role: "MONTADOR",
    mode: "subscription",
    interval: "month",
    priceInCents: 1990, // R$19,90
    plan: "BASIC",
    storeProductId: "br.com.dular.montador.basico.mensal",
  },
  montador_pro_mensal: {
    id: "montador_pro_mensal",
    name: "Pro Mensal",
    description: "Serviços ilimitados por mês",
    role: "MONTADOR",
    mode: "subscription",
    interval: "month",
    priceInCents: 3990, // R$39,90
    plan: "PREMIUM",
    storeProductId: "br.com.dular.montador.pro.mensal",
  },
  montador_pro_anual: {
    id: "montador_pro_anual",
    name: "Pro Anual",
    description: "Serviços ilimitados por 1 ano",
    role: "MONTADOR",
    mode: "subscription",
    interval: "year",
    priceInCents: 35900, // R$359,00
    plan: "PREMIUM",
    storeProductId: "br.com.dular.montador.pro.anual",
  },
};

/**
 * Do id da loja de volta para o plano. É por aqui que um recibo da App Store
 * ou do Google Play vira uma assinatura no banco: a loja só devolve o
 * `productId`, e é ele que precisa dizer qual plano foi comprado.
 */
export function planoPorProdutoDaLoja(storeProductId: string): PlanDef | null {
  return Object.values(PLANS).find((p) => p.storeProductId === storeProductId) ?? null;
}

/**
 * Quando a assinatura expira, a partir do início e do intervalo do plano.
 *
 * Só entra em cena como reserva: quando o provedor informa o fim do período
 * (o Stripe no invoice, as lojas no `expiresDate`), é o dele que vale — seguir
 * o relógio de quem cobra evita o acesso e a cobrança andarem separados.
 *
 * O dia é limitado ao último do mês de destino porque `setMonth` transborda:
 * 31/01 + 1 mês vira 03/03, e a pessoa ganhava três dias de graça todo mês
 * curto. 31/01 agora vira 28/02 (ou 29, em bissexto).
 */
export function validadeDoPlano(plan: PlanDef, inicio = new Date()): Date {
  const fim = new Date(inicio);
  const dia = fim.getDate();

  if (plan.interval === "year") {
    fim.setFullYear(fim.getFullYear() + 1);
  } else {
    fim.setDate(1);
    fim.setMonth(fim.getMonth() + 1);
    const ultimoDiaDoMes = new Date(fim.getFullYear(), fim.getMonth() + 1, 0).getDate();
    fim.setDate(Math.min(dia, ultimoDiaDoMes));
  }
  return fim;
}
