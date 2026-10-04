import { stripe, PLANS, validadeDoPlano } from "@/lib/stripe";
import {
  planoDosMetadados,
  processarEventoStripe,
  sincronizarPlanoStripe,
  versaoDoPlanoStripe,
  vincularAssinaturaStripe,
  type EventoRecebidoStripe,
  type EventoStripe,
  type ResultadoEventoStripe,
  type TipoCicloStripe,
  type VinculoStripe,
} from "@/lib/assinatura";
import { marcarCheckout, marcarTrocasAplicadas, marcarTrocasExpiradas, retomarOperacoes } from "@/lib/trocaDePlano";
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

  // A Stripe não garante ordem nem entrega única. Os eventos de assinatura
  // se ordenam pelo `created` e pelo id do PRÓPRIO evento (lib/assinatura).
  const evento = eventoDaStripe(event);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, evento);
        break;

      // Pagamento que se confirma depois (boleto, Pix): o `completed` chega com
      // `payment_status: "unpaid"` e o dinheiro só está garantido aqui.
      case "checkout.session.async_payment_succeeded":
        await handleCompraAssincrona(event.data.object as Stripe.Checkout.Session);
        break;

      case "checkout.session.async_payment_failed":
        handleCompraAssincronaRecusada(event.data.object as Stripe.Checkout.Session);
        break;

      case "checkout.session.expired":
        await handleCheckoutExpirado(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, evento);
        break;

      // Troca de plano aplicada pela Stripe (pagamento confirmado ou fase do
      // downgrade agendado): o objeto é o retrato da assinatura naquele momento.
      case "customer.subscription.updated":
      case "customer.subscription.pending_update_applied":
        await handleRetratoDaAssinatura(event.data.object as Stripe.Subscription);
        break;

      // Troca não paga descartada pela Stripe: o plano anterior segue como estava.
      case "customer.subscription.pending_update_expired":
        await handleTrocaExpirada(event.data.object as Stripe.Subscription);
        break;

      // Renovação. Sem tratar isto, a validade parava no primeiro período: o
      // Stripe seguia cobrando e o acesso caía, porque quem decide o acesso é
      // o `expiresAt` gravado aqui.
      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice, evento);
        break;

      // Pagamento falhou. Antes, quem parava de pagar mantinha o plano até o
      // Stripe desistir das tentativas e mandar o `deleted` — dias ou semanas
      // de acesso pago por ninguém.
      case "invoice.payment_failed":
        await handleInvoiceFailed(event.data.object as Stripe.Invoice, evento);
        break;
    }
  } catch (err) {
    console.error("[stripe-webhook] erro ao processar evento:", event.type, err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/** `created` (segundos) e id do evento. Eventos reais sempre têm os dois. */
function eventoDaStripe(event: Stripe.Event): EventoStripe | null {
  const { created, id } = event as { created?: unknown; id?: unknown };
  if (typeof created !== "number" || !Number.isInteger(created) || created <= 0) return null;
  if (typeof id !== "string" || id === "") return null;
  return { quando: new Date(created * 1000), eventId: id };
}

/** Sem `created`/id não há como ordenar: o evento de assinatura não escreve. */
function semEvento(tipo: string, objeto: unknown) {
  console.error("[stripe-webhook] evento de assinatura sem id ou created; nada foi alterado:", tipo, objeto);
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, evento: EventoStripe | null) {
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
    const assinaturaId = idDeAssinatura(session.subscription);
    if (!assinaturaId) {
      console.error("[stripe-webhook] sessão de assinatura sem id sub_ válido; nada foi alterado:", session.id);
      return;
    }
    if (!evento) return semEvento("checkout.session.completed", session.id);

    // Só cria ou troca o VÍNCULO usuário↔assinatura (mesma `sub_` → nada
    // escrito). O período efetivo vem dos eventos de ciclo de vida: o
    // `invoice.paid` costuma chegar ANTES deste evento e já está guardado.
    await vincularAssinaturaStripe({ userId, plano, externalId: assinaturaId, quando: evento.quando });
    await marcarCheckout(session.id, "concluida", assinaturaId);
    // Se o vínculo trocou de `sub_`, a anterior tem cancelamento pendente.
    await retomarOperacoes({ userId });
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

async function handleCheckoutExpirado(session: Stripe.Checkout.Session) {
  if (typeof session.id === "string" && session.id.startsWith("cs_")) await marcarCheckout(session.id, "descartada", null);
}

/**
 * Plano da linha a partir do retrato da assinatura. A Stripe só troca item e
 * metadados juntos quando a troca é paga (pending update) ou quando a fase do
 * downgrade começa; a versão em `metadata.planoVersao` ordena as trocas, então
 * retrato antigo ou reentregue não desfaz uma mais nova (lib/assinatura).
 */
async function handleRetratoDaAssinatura(subscription: Stripe.Subscription) {
  const assinaturaId = idDeAssinatura(subscription.id);
  if (!assinaturaId) return;
  await sincronizarPelosMetadados(assinaturaId, (subscription.metadata ?? {}) as Record<string, string>);
  await retomarOperacoes({ externalId: assinaturaId });
}

/** Plano pelos metadados da assinatura (retrato ou fatura), sempre por versão. */
async function sincronizarPelosMetadados(assinaturaId: string, metadata: Record<string, string>) {
  const planId = metadata.planId;
  // Legado sem `planId`: nada a sincronizar; o plano do vínculo segue.
  if (!planId || !(planId in PLANS)) return;
  const versao = versaoDoPlanoStripe(metadata);
  await sincronizarPlanoStripe(assinaturaId, PLANS[planId as keyof typeof PLANS], versao);
  await marcarTrocasAplicadas(assinaturaId, planId, versao);
}

async function handleTrocaExpirada(subscription: Stripe.Subscription) {
  const assinaturaId = idDeAssinatura(subscription.id);
  if (assinaturaId) await marcarTrocasExpiradas(assinaturaId);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, evento: EventoStripe | null) {
  const assinaturaId = idDeAssinatura(subscription.id);
  if (!assinaturaId) return;
  if (!evento) return semEvento("customer.subscription.deleted", assinaturaId);
  await registrarEvento("customer.subscription.deleted", assinaturaId, evento, { fimPeriodo: null, faturaId: null }, null);
}

/** Pagamento confirmado (compra ou renovação): validade até o fim do período cobrado. */
async function handleInvoicePaid(invoice: Stripe.Invoice, evento: EventoStripe | null) {
  const assinaturaId = idDaAssinatura(invoice);
  if (!assinaturaId) return;
  if (!evento) return semEvento("invoice.paid", invoice.id);

  // Fim do período que o Stripe acabou de cobrar. É a fonte certa: seguir o
  // relógio do provedor evita o acesso e a cobrança andarem separados.
  const planoDaFatura = planoDosMetadados(invoice.metadata as Record<string, string>);
  const fimPeriodo = fimDoPeriodoDaFatura(invoice) ?? (planoDaFatura ? validadeDoPlano(planoDaFatura) : null);

  // Sem linha desta assinatura (na compra, o `invoice.paid` chega ANTES do
  // `completed`), o vínculo nasce pelos metadados da ASSINATURA que o
  // /billing/checkout grava (`subscription_data.metadata`) — mas só na PRIMEIRA
  // fatura. Renovação nunca cria nem troca vínculo: uma assinatura substituída
  // continua renovando, e o `created` da renovação não prova que ela é a mais nova.
  const metadados = metadadosDaAssinatura(invoice);
  const userId = metadados?.userId;
  const plano = planoDosMetadados(metadados);
  const primeiraFatura = invoice.billing_reason === "subscription_create";
  const vinculo = primeiraFatura && typeof userId === "string" && userId !== "" && plano ? { userId, plano } : null;

  await registrarEvento("invoice.paid", assinaturaId, evento, { fimPeriodo, faturaId: idDaFatura(invoice) }, vinculo);
  // A fatura guarda os metadados da assinatura de quando foi emitida: a da
  // renovação que entra no downgrade agendado já traz o plano menor. Segundo
  // caminho, além do `customer.subscription.updated`, sempre por versão.
  if (metadados) await sincronizarPelosMetadados(assinaturaId, metadados);
  // Assinatura nova paga: libera o cancelamento pendente da que ela substituiu.
  await retomarOperacoes({ externalId: assinaturaId });
}

/**
 * Pagamento falhou: corta na hora da PRIMEIRA falha, a menos que a fatura do
 * período acabe paga. O período da fatura que falhou entra na ordem (lib/assinatura).
 *
 * Exceção: a fatura de uma TROCA de plano (`subscription_update`). A troca é
 * feita com `pending_if_incomplete` — sem pagamento ela simplesmente não é
 * aplicada, e o período já pago continua valendo. Contá-la como falha cortaria
 * o plano anterior por causa de um upgrade recusado.
 */
async function handleInvoiceFailed(invoice: Stripe.Invoice, evento: EventoStripe | null) {
  const assinaturaId = idDaAssinatura(invoice);
  if (!assinaturaId) return;
  if (invoice.billing_reason === "subscription_update") {
    console.info("[stripe-webhook] falha na fatura de troca de plano; a troca não foi aplicada e o plano anterior segue:", assinaturaId, invoice.id);
    return;
  }
  if (!evento) return semEvento("invoice.payment_failed", invoice.id);
  const fatura = { fimPeriodo: fimDoPeriodoDaFatura(invoice), faturaId: idDaFatura(invoice) };
  await registrarEvento("invoice.payment_failed", assinaturaId, evento, fatura, null);
}

const SEM_EFEITO: Record<Exclude<ResultadoEventoStripe, "aplicado">, string> = {
  repetido: "evento já processado; nada alterado",
  sem_mudanca: "estado já refletia o evento; nada alterado",
  guardado: "sem vínculo para esta assinatura; evento guardado para o checkout.session.completed",
  sem_usuario: "usuário dos metadados da assinatura não existe; evento guardado",
};

/** Guarda o evento e recalcula a assinatura (lib/assinatura). */
async function registrarEvento(
  tipo: TipoCicloStripe,
  externalId: string,
  evento: EventoStripe,
  fatura: Pick<EventoRecebidoStripe, "fimPeriodo" | "faturaId">,
  vinculo: Pick<VinculoStripe, "userId" | "plano"> | null,
) {
  const resultado = await processarEventoStripe(
    { eventId: evento.eventId, externalId, tipo, criadoEm: evento.quando, ...fatura },
    vinculo,
  );
  if (resultado === "aplicado") return;
  const log = resultado === "sem_usuario" ? console.error : console.info;
  log(`[stripe-webhook] ${tipo}: ${SEM_EFEITO[resultado]}:`, externalId, evento.eventId);
}

// Formato bruto da fatura: cada versão da API põe a assinatura num lugar, e o
// evento chega na versão configurada no endpoint, não na do client acima.
type FaturaBruta = {
  parent?: { type?: unknown; subscription_details?: { subscription?: unknown; metadata?: unknown } | null } | null;
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

/**
 * Metadados da ASSINATURA que a fatura carrega — só com `parent.type`
 * `subscription_details`, a mesma regra de `idDaAssinatura`.
 */
function metadadosDaAssinatura(invoice: Stripe.Invoice): Record<string, string> | null {
  const parent = (invoice as unknown as FaturaBruta).parent;
  if (parent?.type !== "subscription_details") return null;
  const metadata = parent.subscription_details?.metadata;
  return typeof metadata === "object" && metadata !== null ? (metadata as Record<string, string>) : null;
}

/** `in_…` da fatura; null quando não vem. */
function idDaFatura(invoice: Stripe.Invoice): string | null {
  const id: unknown = invoice.id;
  return typeof id === "string" && /^in_\w+$/.test(id) ? id : null;
}

/**
 * Fim do período cobrado pela fatura: o MAIOR `period.end` das linhas; null
 * quando nenhuma traz. Fatura de ciclo tem uma linha só. A da troca mensal →
 * anual tem o crédito do mês (fim antigo) e o anual novo (fim um ano adiante):
 * a validade paga é a do anual, não a da linha que vier primeiro.
 */
function fimDoPeriodoDaFatura(invoice: Stripe.Invoice): Date | null {
  const fins = (invoice.lines?.data ?? [])
    .map((linha) => linha?.period?.end as unknown)
    .filter((fim): fim is number => typeof fim === "number" && fim > 0);
  return fins.length > 0 ? new Date(Math.max(...fins) * 1000) : null;
}

/** Id de assinatura (`sub_…`) em string ou no objeto expandido; o resto é ignorado. */
function idDeAssinatura(valor: unknown): string | null {
  const id = typeof valor === "object" && valor !== null ? (valor as { id?: unknown }).id : valor;
  return typeof id === "string" && /^sub_\w+$/.test(id) ? id : null;
}
