import { prisma } from "@/lib/prisma";
import { PLANS, validadeDoPlano, type PlanDef } from "@/lib/stripe";
import type { SubscriptionProvider } from "@prisma/client";

/**
 * Conceder e revogar assinatura — um lugar só, para os três provedores.
 *
 * Stripe, App Store e Google Play avisam por canais diferentes e com formatos
 * diferentes, mas o efeito no sistema é o mesmo: alguém passa a ter (ou deixa
 * de ter) um plano até uma data. Cada webhook traduz o seu recado para estas
 * duas funções, e a regra de acesso continua existindo em um lugar só.
 */

export type ConcessaoAssinatura = {
  userId: string;
  plano: PlanDef;
  provider: SubscriptionProvider;
  /** id da assinatura no provedor. Um por provedor — ver índice único. */
  externalId: string;
  /**
   * Fim do período pago, quando o provedor informa. A Apple e o Google mandam
   * `expiresDate` a cada renovação; o Stripe manda o fim do período no invoice.
   * Sem isso, calculamos pelo intervalo do plano.
   */
  expiraEm?: Date | null;
};

/**
 * Registra uma compra ou renovação.
 *
 * A validade vem do provedor quando ele informa. Antes era sempre "hoje + 1
 * mês", inclusive no plano ANUAL de R$ 359 — o campo não era lido por
 * ninguém, então o erro passava despercebido; agora que o acesso depende dele,
 * passaria a cortar o acesso 11 meses cedo.
 */
export async function concederAssinatura(dados: ConcessaoAssinatura) {
  const { userId, plano, provider, externalId, expiraEm } = dados;
  const expiresAt = expiraEm ?? validadeDoPlano(plano);

  return prisma.subscription.upsert({
    where: { userId },
    update: {
      plan: plano.plan,
      status: "ACTIVE",
      provider,
      externalId,
      storeProductId: provider === "STRIPE" ? null : plano.storeProductId,
      startedAt: new Date(),
      expiresAt,
      canceledAt: null,
    },
    create: {
      userId,
      plan: plano.plan,
      status: "ACTIVE",
      provider,
      externalId,
      storeProductId: provider === "STRIPE" ? null : plano.storeProductId,
      expiresAt,
    },
  });
}

/**
 * Encerra a assinatura identificada pelo provedor.
 *
 * `motivo` separa o que a pessoa pediu do que o pagamento causou: cancelamento
 * pedido vale até o fim do período já pago (não se tira o que foi pago), e
 * falha de pagamento corta na hora, porque o período seguinte não foi pago.
 */
export async function encerrarAssinatura(
  provider: SubscriptionProvider,
  externalId: string,
  motivo: "cancelada" | "nao_paga",
) {
  return prisma.subscription.updateMany({
    where: { provider, externalId },
    data: {
      status: motivo === "nao_paga" ? "EXPIRED" : "CANCELED",
      canceledAt: new Date(),
      // Cancelou: mantém até o fim do que pagou. Não pagou: acaba agora.
      ...(motivo === "nao_paga" ? { expiresAt: new Date() } : {}),
    },
  });
}

/**
 * Plano do catálogo a partir do que o Stripe guardou nos metadados.
 *
 * `planId` é o caminho certo — só ele diz o intervalo, e é o que separa o
 * mensal do anual. Mas quem PAGOU não pode ficar sem plano porque um metadado
 * faltou: uma sessão criada antes desta versão, ou um evento reprocessado com
 * payload antigo, ainda traz o `subscriptionPlan` (BASIC/PREMIUM). Nesse caso
 * caímos no mensal daquele nível — que é exatamente o que o código fazia antes
 * — em vez de recusar a concessão.
 */
export function planoDosMetadados(metadata: Record<string, string> | null | undefined) {
  const planId = metadata?.planId;
  if (planId && planId in PLANS) return PLANS[planId as keyof typeof PLANS];

  const nivel = metadata?.subscriptionPlan;
  if (nivel === "BASIC" || nivel === "PREMIUM") {
    const reserva = Object.values(PLANS).find(
      (p) => p.plan === nivel && p.interval === "month",
    );
    if (reserva) {
      console.warn(
        "[assinatura] sessão sem planId; usando o mensal de",
        nivel,
        "como reserva.",
      );
      return reserva;
    }
  }
  return null;
}
