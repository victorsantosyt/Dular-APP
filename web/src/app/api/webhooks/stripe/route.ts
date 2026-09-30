import { stripe } from "@/lib/stripe";
import { concederAssinatura, encerrarAssinatura, planoDosMetadados } from "@/lib/assinatura";
import { validadeDoPlano } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

function hasValidWebhookSecret(secret: string) {
  const value = secret.trim();
  return value.startsWith("whsec_") && !value.includes("...");
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  const allowUnsignedDevWebhook =
    process.env.NODE_ENV !== "production" &&
    process.env.STRIPE_WEBHOOK_ALLOW_UNSIGNED_DEV === "true";

  let event: Stripe.Event;

  if (hasValidWebhookSecret(webhookSecret)) {
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  } else if (allowUnsignedDevWebhook) {
    // DEV only: permite testar webhooks locais sem assinatura quando explicitamente habilitado.
    try {
      event = JSON.parse(body) as Stripe.Event;
    } catch {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
  } else {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      // Pagamento que se confirma depois (boleto, Pix): o `completed` chega com
      // `payment_status: "unpaid"` e o dinheiro só está garantido aqui.
      case "checkout.session.async_payment_succeeded":
        await handleCompraAssincrona(event.data.object as Stripe.Checkout.Session);
        break;

      case "checkout.session.async_payment_failed":
        handleCompraAssincronaRecusada(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      // Renovação. Sem tratar isto, a validade parava no primeiro período: o
      // Stripe seguia cobrando e o acesso caía, porque quem decide o acesso é
      // o `expiresAt` gravado aqui.
      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      // Pagamento falhou. Antes, quem parava de pagar mantinha o plano até o
      // Stripe desistir das tentativas e mandar o `deleted` — dias ou semanas
      // de acesso pago por ninguém.
      case "invoice.payment_failed":
        await handleInvoiceFailed(event.data.object as Stripe.Invoice);
        break;
    }
  } catch (err) {
    console.error("[stripe-webhook] erro ao processar evento:", event.type, err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id;
  if (!userId) return;

  const metadata = session.metadata ?? {};

  if (session.mode === "subscription") {
    // O plano vem dos metadados que o /billing/checkout gravou. Sem ele não dá
    // para saber o intervalo, e "hoje + 1 mês" cortaria o anual 11 meses cedo.
    const plano = planoDosMetadados(metadata as Record<string, string>);
    if (!plano) {
      console.error("[stripe-webhook] sessão sem planId nos metadados:", session.id);
      return;
    }

    await concederAssinatura({
      userId,
      plano,
      provider: "STRIPE",
      externalId: session.subscription as string,
    });
  }

  if (session.mode === "payment") {
    await creditarSessaoPaga(session);
  }
}

/** Boleto/Pix confirmado: credita a compra que o `completed` deixou pendente. */
async function handleCompraAssincrona(session: Stripe.Checkout.Session) {
  // Assinatura com pagamento assíncrono segue o fluxo atual (invoice.*).
  if (session.mode !== "payment") return;
  await creditarSessaoPaga(session);
}

/** Boleto/Pix recusado: nada foi creditado (o `completed` chegou "unpaid"). */
function handleCompraAssincronaRecusada(session: Stripe.Checkout.Session) {
  if (session.mode !== "payment") return;
  console.warn("[stripe-webhook] pagamento assíncrono recusado; nada foi creditado:", session.id);
}

/**
 * Compra de créditos: só credita com o pagamento confirmado (`paid`). O
 * `completed` de boleto/Pix chega "unpaid" e fica esperando o
 * `async_payment_succeeded`; `no_payment_required` (total zero) não credita.
 * Os dois eventos da mesma compra caem em `creditarCompra`, que credita uma
 * vez só por sessão, em qualquer ordem de chegada.
 */
async function creditarSessaoPaga(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id;
  if (!userId) return;
  const credits = quantidadeDeCreditos(session.metadata?.credits);
  if (credits === null) {
    console.error("[stripe-webhook] quantidade de créditos inválida; nada foi creditado:", session.id);
    return;
  }
  if (typeof session.id !== "string" || !session.id.startsWith("cs_")) {
    console.error("[stripe-webhook] compra de créditos sem id de sessão; nada foi creditado.");
    return;
  }
  if (session.payment_status !== "paid") {
    console.info("[stripe-webhook] compra sem pagamento confirmado; nada creditado por ora:", session.id, session.payment_status);
    return;
  }
  await creditarCompra(userId, credits, session.id);
}

/** Não há pacote de créditos à venda hoje: acima disso é erro de configuração. */
const MAX_CREDITOS_POR_COMPRA = 1000;

/** Inteiro positivo escrito só com dígitos (`"5"`), até o máximo; o resto é recusado. */
function quantidadeDeCreditos(valor: unknown): number | null {
  if (typeof valor !== "string" || !/^[1-9][0-9]*$/.test(valor)) return null;
  const credits = Number(valor);
  return credits <= MAX_CREDITOS_POR_COMPRA ? credits : null;
}

/**
 * Credita uma compra UMA vez. Saldo e lançamento vão na mesma transação, e o
 * lançamento leva o id da sessão com índice único: uma segunda entrega da
 * mesma compra — repetida, simultânea ou reenviada depois de uma falha —
 * esbarra no índice e desfaz a transação inteira, sem saldo somado à toa.
 */
async function creditarCompra(userId: string, credits: number, sessaoId: string) {
  try {
    await prisma.$transaction(async (tx) => {
      const wallet = await tx.creditWallet.upsert({
        where: { userId },
        update: { balance: { increment: credits } },
        create: { userId, balance: credits },
      });

      await tx.creditTransaction.create({
        data: {
          walletId: wallet.id,
          type: "CREDIT",
          amount: credits,
          description: `Compra de ${credits} crédito${credits > 1 ? "s" : ""}`,
          stripeCheckoutSessionId: sessaoId,
        },
      });
    });
  } catch (err) {
    // Se o lançamento desta sessão existe, outra entrega já creditou: é
    // repetição, não falha. Sem ele, o erro é real — vira 500 e o Stripe reenvia.
    const jaCreditada = await prisma.creditTransaction.findUnique({
      where: { stripeCheckoutSessionId: sessaoId },
      select: { id: true },
    });
    if (!jaCreditada) throw err;
    console.warn("[stripe-webhook] compra já creditada; entrega repetida ignorada:", sessaoId);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await encerrarAssinatura("STRIPE", subscription.id, "cancelada");
}

/** Renovação paga: estende a validade até o fim do novo período. */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const assinaturaId = idDaAssinatura(invoice);
  if (!assinaturaId) return;

  const atual = await prisma.subscription.findFirst({
    where: { provider: "STRIPE", externalId: assinaturaId },
    select: { userId: true },
  });
  if (!atual) return;

  // Fim do período que o Stripe acabou de cobrar. É a fonte certa: seguir o
  // relógio do provedor evita o acesso e a cobrança andarem separados.
  const fimDoPeriodo = invoice.lines?.data?.[0]?.period?.end;
  const plano = planoDosMetadados(invoice.metadata as Record<string, string>);

  await prisma.subscription.updateMany({
    where: { provider: "STRIPE", externalId: assinaturaId },
    data: {
      status: "ACTIVE",
      canceledAt: null,
      expiresAt: fimDoPeriodo
        ? new Date(fimDoPeriodo * 1000)
        : plano
          ? validadeDoPlano(plano)
          : undefined,
    },
  });
}

/** Pagamento falhou: encerra na hora — o período seguinte não foi pago. */
async function handleInvoiceFailed(invoice: Stripe.Invoice) {
  const assinaturaId = idDaAssinatura(invoice);
  if (!assinaturaId) return;
  await encerrarAssinatura("STRIPE", assinaturaId, "nao_paga");
}

// Formato bruto da fatura: cada versão da API põe a assinatura num lugar, e o
// evento chega na versão configurada no endpoint, não na do client acima.
type FaturaBruta = {
  parent?: { type?: unknown; subscription_details?: { subscription?: unknown } | null } | null;
  subscription?: unknown;
  lines?: { data?: Array<{ subscription?: unknown } | null> };
};

/**
 * A assinatura da fatura, procurada nesta ordem:
 *  1. `parent.subscription_details.subscription` — desde 2025-03-31.basil, e
 *     só quando `parent.type` é `subscription_details`;
 *  2. `subscription` — versões anteriores;
 *  3. `lines.data[0].subscription` — a linha da fatura.
 * Cada uma pode vir como id ou como objeto expandido. Se as presentes
 * apontarem para assinaturas DIFERENTES, nada é alterado: melhor não mexer do
 * que renovar ou encerrar a assinatura de outra pessoa.
 */
function idDaAssinatura(invoice: Stripe.Invoice): string | null {
  const fatura = invoice as unknown as FaturaBruta;
  const doParent =
    fatura.parent?.type === "subscription_details"
      ? fatura.parent.subscription_details?.subscription
      : undefined;
  const ids = [doParent, fatura.subscription, fatura.lines?.data?.[0]?.subscription]
    .map(idDeAssinatura)
    .filter((id): id is string => id !== null);

  const distintos = [...new Set(ids)];
  if (distintos.length > 1) {
    console.error("[stripe-webhook] fatura com assinaturas divergentes; nada foi alterado:", invoice.id);
    return null;
  }
  return distintos[0] ?? null;
}

/** Id de assinatura (`sub_…`) em string ou no objeto expandido; o resto é ignorado. */
function idDeAssinatura(valor: unknown): string | null {
  const id = typeof valor === "object" && valor !== null ? (valor as { id?: unknown }).id : valor;
  return typeof id === "string" && /^sub_\w+$/.test(id) ? id : null;
}
