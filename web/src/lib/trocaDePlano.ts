import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe, PLANS, type PlanDef } from "@/lib/stripe";
import {
  novaChaveDeOperacao,
  sincronizarPlanoStripe,
  versaoDoPlanoStripe,
} from "@/lib/assinatura";
import type { StripeOperacao } from "@prisma/client";

/**
 * Compra e troca de plano na Stripe — UMA assinatura por pessoa.
 *
 * Quem não tem assinatura viva vai ao Checkout. Quem tem não ganha uma segunda:
 * a MESMA assinatura é alterada. Antes, cada troca abria um Checkout novo e a
 * assinatura anterior seguia renovando e cobrando (reproduzido na sandbox).
 *
 * Regra comercial (decidida pelo dono):
 *  - Upgrade (nível maior, ou mensal → anual): cobra já a diferença
 *    proporcional, com crédito do tempo não usado (`always_invoice`). A troca
 *    só vale com o pagamento confirmado (`pending_if_incomplete`): se falhar,
 *    pedir autenticação ou for abandonado, a Stripe descarta a troca em até 23 h
 *    e o plano anterior segue até o fim do período pago.
 *  - Downgrade (nível menor, ou anual → mensal): agendado para o fim do período
 *    pago (subscription schedule), sem crédito nem estorno.
 *  - Pedir o plano atual desfaz o que estiver pendente ou agendado.
 *
 * Cada pedido vira uma StripeOperacao gravada ANTES da chamada à Stripe, e
 * cada chamada leva a chave de idempotência da operação. Falha no meio deixa a
 * operação `pendente`; a retomada relê o estado na Stripe antes de agir, então
 * não cobra de novo mesmo depois que a chave de idempotência expira (24 h).
 */

// ── Catálogo ─────────────────────────────────────────────────────────────────

const NIVEL: Record<PlanDef["plan"], number> = { BASIC: 1, PREMIUM: 2 };
const CICLO: Record<PlanDef["interval"], number> = { month: 1, year: 2 };

export type Sentido = "mesmo" | "upgrade" | "downgrade" | "misto";

/** Upgrade: nível e ciclo não diminuem. Downgrade: não aumentam. O resto não é suportado. */
export function sentidoDaTroca(de: PlanDef, para: PlanDef): Sentido {
  if (de.id === para.id) return "mesmo";
  const nivel = NIVEL[para.plan] - NIVEL[de.plan];
  const ciclo = CICLO[para.interval] - CICLO[de.interval];
  if (nivel === 0 && ciclo === 0) return "misto";
  if (nivel >= 0 && ciclo >= 0) return "upgrade";
  if (nivel <= 0 && ciclo <= 0) return "downgrade";
  return "misto";
}

/** Metadados da assinatura: os do checkout mais a versão da troca. */
export function metadadosDoPlano(userId: string, plano: PlanDef, versao: number): Record<string, string> {
  return { userId, planId: plano.id, subscriptionPlan: plano.plan, planoVersao: String(versao) };
}

/**
 * Preço de catálogo do plano. A troca e o agendamento exigem um Price da
 * Stripe (o checkout usa preço inline). Produto com id fixo e preço com
 * `lookup_key` derivada de valor e intervalo: criados uma vez, sob demanda;
 * mudar o valor no catálogo gera outro preço, sem reaproveitar o antigo.
 */
export async function precoDoPlano(plano: PlanDef): Promise<string> {
  const lookup = `dular_${plano.id}_${plano.priceInCents}_${plano.interval}`;
  const achado = await stripe.prices.list({ lookup_keys: [lookup], active: true, limit: 1 });
  if (achado.data[0]) return achado.data[0].id;

  const produto = `dular_plano_${plano.id}`;
  try {
    await stripe.products.create(
      { id: produto, name: plano.name, description: plano.description },
      { idempotencyKey: `dular-produto-${produto}` },
    );
  } catch (err) {
    if (codigoStripe(err) !== "resource_already_exists") throw err;
  }
  const preco = await stripe.prices.create(
    {
      product: produto,
      currency: "brl",
      unit_amount: plano.priceInCents,
      recurring: { interval: plano.interval },
      lookup_key: lookup,
    },
    { idempotencyKey: `dular-preco-${lookup}` },
  );
  return preco.id;
}

/** Plano em vigor: pelos metadados; no legado sem `planId`, pelo valor e intervalo do item. */
export function planoDaAssinatura(sub: Stripe.Subscription, role: string): PlanDef | null {
  const planId = sub.metadata?.planId;
  if (planId && planId in PLANS) {
    const plano = PLANS[planId as keyof typeof PLANS];
    return plano.role === role ? plano : null;
  }
  const preco = sub.items?.data?.[0]?.price;
  const candidatos = Object.values(PLANS).filter(
    (p) => p.role === role && p.priceInCents === preco?.unit_amount && p.interval === preco?.recurring?.interval,
  );
  return candidatos.length === 1 ? candidatos[0] : null;
}

const idDe = (v: unknown): string | null =>
  typeof v === "string" ? v : typeof v === "object" && v !== null && typeof (v as { id?: unknown }).id === "string" ? (v as { id: string }).id : null;

const precoDoItem = (sub: Stripe.Subscription) => idDe(sub.items?.data?.[0]?.price);
const precoPendente = (sub: Stripe.Subscription) => idDe(sub.pending_update?.subscription_items?.[0]?.price);

function codigoStripe(err: unknown): string | null {
  const codigo = (err as { code?: unknown })?.code;
  return typeof codigo === "string" ? codigo : null;
}

/** Erro que repetir não resolve (requisição inválida). O resto — rede, 5xx, limite, banco — é transitório. */
function erroPermanente(err: unknown): boolean {
  const { type, statusCode } = (err ?? {}) as { type?: unknown; statusCode?: unknown };
  return type === "StripeInvalidRequestError" && (statusCode === 400 || statusCode === 404);
}

function resumoDoErro(err: unknown): string {
  const { type, code, message } = (err ?? {}) as { type?: unknown; code?: unknown; message?: unknown };
  return [type, code, typeof message === "string" ? message.slice(0, 200) : null].filter(Boolean).join(": ");
}

// ── Estado da assinatura na Stripe ──────────────────────────────────────────

const VIVAS = new Set<string>(["active", "trialing"]);
/** Ainda pode cobrar, mas com pagamento em aberto: nem troca nem checkout novo. */
const COM_PENDENCIA = new Set<string>(["past_due", "unpaid", "incomplete", "paused"]);

async function buscarAssinatura(id: string): Promise<Stripe.Subscription | null> {
  try {
    return await stripe.subscriptions.retrieve(id, { expand: ["latest_invoice", "schedule"] });
  } catch (err) {
    if (codigoStripe(err) === "resource_missing") return null;
    throw err;
  }
}

// ── Resultado devolvido à rota ──────────────────────────────────────────────

export type SituacaoTroca = "aplicada" | "aguardando_pagamento" | "agendada" | "sem_mudanca";

export type ResultadoPedido =
  | { tipo: "checkout"; url: string }
  | { tipo: "troca"; situacao: SituacaoTroca; url: string | null; vigenteEm?: Date }
  | { tipo: "recusado"; status: number; codigo: string; mensagem: string };

const recusado = (status: number, codigo: string, mensagem: string): ResultadoPedido => ({ tipo: "recusado", status, codigo, mensagem });

// ── Trava por usuário ───────────────────────────────────────────────────────

/** Pedidos da mesma pessoa, um de cada vez. Mutável só para os testes. */
export const limitesTroca = { lockTimeoutMs: 10_000, maxWaitMs: 5_000, timeoutMs: 45_000 };

export class OperacaoEmAndamento extends Error {}

/**
 * Lock consultivo da pessoa, numa transação que só segura a trava. As escritas
 * de dentro usam o client global e são confirmadas na hora: a operação fica
 * gravada antes da chamada à Stripe mesmo que o processo caia no meio.
 */
async function comTravaDoUsuario<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const { lockTimeoutMs, maxWaitMs, timeoutMs } = limitesTroca;
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('lock_timeout', ${String(lockTimeoutMs)}, true)`;
      try {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(7703, hashtext(${userId}))`;
      } catch (err) {
        // Só a espera por ESTA trava vira "em andamento"; lock de outra coisa lá dentro é falha comum.
        if (/lock timeout|55P03/i.test(String((err as { message?: unknown })?.message ?? ""))) {
          throw new OperacaoEmAndamento("outro pedido desta pessoa ainda está em andamento");
        }
        throw err;
      }
      return fn();
    },
    { maxWait: maxWaitMs, timeout: timeoutMs },
  );
}

// ── Pedido de plano ─────────────────────────────────────────────────────────

export type PedidoDePlano = {
  userId: string;
  role: string;
  plano: PlanDef;
  /** Parâmetros da sessão de Checkout, para quem ainda não tem assinatura. */
  checkout: Stripe.Checkout.SessionCreateParams;
  /** Página para onde o app volta quando não há nada a pagar. */
  urlConcluida: string;
};

export async function pedirPlano(pedido: PedidoDePlano): Promise<ResultadoPedido> {
  return comTravaDoUsuario(pedido.userId, async () => {
    await retomarNaTrava({ userId: pedido.userId });

    const linha = await prisma.subscription.findUnique({
      where: { userId: pedido.userId },
      select: { provider: true, externalId: true },
    });
    const vinculada = linha?.provider === "STRIPE" && linha.externalId?.startsWith("sub_") ? linha.externalId : null;
    const sub = vinculada ? await buscarAssinatura(vinculada) : null;

    if (sub && VIVAS.has(sub.status)) return trocar(pedido, sub);
    if (sub && COM_PENDENCIA.has(sub.status)) {
      return recusado(409, "ASSINATURA_COM_PENDENCIA", "Há um pagamento pendente na sua assinatura atual. Regularize-o antes de trocar de plano.");
    }
    return iniciarCheckout(pedido, vinculada);
  });
}

/**
 * Sem assinatura viva: no máximo UMA sessão de Checkout aberta por pessoa. O
 * mesmo pedido de novo devolve a mesma sessão; outro plano expira a anterior.
 * Sessão já paga cujo vínculo ainda não chegou: espera, não abre outra.
 */
async function iniciarCheckout(pedido: PedidoDePlano, vinculada: string | null): Promise<ResultadoPedido> {
  const { userId, plano } = pedido;
  const abertas = await prisma.stripeOperacao.findMany({
    where: { userId, tipo: "checkout", status: "aguardando" },
    orderBy: { createdAt: "asc" },
  });
  for (const op of abertas) {
    let sessao = await stripe.checkout.sessions.retrieve(op.referencia!);
    if (sessao.status === "open") {
      if (op.planId === plano.id && op.url) return { tipo: "checkout", url: op.url };
      try {
        sessao = await stripe.checkout.sessions.expire(sessao.id, {}, { idempotencyKey: `${op.chave}:expirar` });
      } catch (err) {
        // Pagou entre a leitura e a expiração: a sessão não está mais aberta.
        sessao = await stripe.checkout.sessions.retrieve(sessao.id);
        if (sessao.status !== "complete" && sessao.status !== "expired") throw err;
      }
    }
    await prisma.stripeOperacao.update({
      where: { id: op.id },
      data: sessao.status === "complete" ? { status: "concluida", externalId: idDe(sessao.subscription) } : { status: "descartada" },
    });
  }

  // Sessão paga cuja assinatura ainda não virou vínculo (webhook atrasado):
  // todo pedido espera — abrir outra sessão criaria a segunda assinatura.
  const pagas = await prisma.stripeOperacao.findMany({
    where: { userId, tipo: "checkout", status: "concluida", externalId: { not: null }, createdAt: { gte: new Date(Date.now() - 3 * 86_400_000) } },
    select: { externalId: true },
  });
  for (const { externalId } of pagas) {
    if (!externalId || externalId === vinculada) continue;
    const sub = await buscarAssinatura(externalId);
    if (sub && (VIVAS.has(sub.status) || COM_PENDENCIA.has(sub.status))) {
      return recusado(409, "ASSINATURA_EM_CONFIRMACAO", "Seu pagamento está sendo confirmado. Tente novamente em instantes.");
    }
  }

  const op = await prisma.stripeOperacao.create({
    data: { userId, tipo: "checkout", status: "pendente", planId: plano.id, chave: novaChaveDeOperacao("checkout") },
  });
  const sessao = await stripe.checkout.sessions.create(pedido.checkout, { idempotencyKey: `${op.chave}:sessao` });
  if (!sessao.url) throw new Error("sessão de checkout sem url");
  await prisma.stripeOperacao.update({
    where: { id: op.id },
    data: { status: "aguardando", referencia: sessao.id, url: sessao.url },
  });
  return { tipo: "checkout", url: sessao.url };
}

async function trocar(pedido: PedidoDePlano, sub: Stripe.Subscription): Promise<ResultadoPedido> {
  const { userId, role, plano: alvo } = pedido;
  const atual = planoDaAssinatura(sub, role);
  if (!atual) return recusado(409, "PLANO_ATUAL_DESCONHECIDO", "Não foi possível identificar o seu plano atual. Fale com o suporte.");
  if (sub.cancel_at_period_end || sub.cancel_at) {
    return recusado(409, "ASSINATURA_ENCERRANDO", "Sua assinatura atual está programada para encerrar.");
  }

  const sentido = sentidoDaTroca(atual, alvo);
  if (sentido === "misto") return recusado(409, "TROCA_NAO_SUPORTADA", "Esta troca de plano não está disponível.");

  // Pedido igual ao que já está em andamento: mesma resposta, nenhuma chamada nova.
  if (sentido === "upgrade" && sub.pending_update && precoPendente(sub) === (await precoDoPlano(alvo))) {
    const fatura = sub.latest_invoice as Stripe.Invoice | null;
    return { tipo: "troca", situacao: "aguardando_pagamento", url: fatura?.hosted_invoice_url ?? null };
  }
  if (sentido === "mesmo" && !sub.pending_update && !sub.schedule) {
    await sincronizarPlanoStripe(sub.id, atual, versaoDoPlanoStripe(sub.metadata));
    return { tipo: "troca", situacao: "sem_mudanca", url: pedido.urlConcluida };
  }

  // A troca que esperava pagamento é substituída por este pedido (a Stripe anula a fatura dela).
  await prisma.stripeOperacao.updateMany({
    where: { externalId: sub.id, tipo: "upgrade", status: "aguardando" },
    data: { status: "descartada", erro: "substituida_por_novo_pedido" },
  });
  const op = await prisma.stripeOperacao.create({
    data: {
      userId,
      tipo: sentido === "mesmo" ? "manter" : sentido,
      status: "pendente",
      planId: alvo.id,
      externalId: sub.id,
      versao: versaoDoPlanoStripe(sub.metadata) + 1,
      chave: novaChaveDeOperacao(sentido === "mesmo" ? "manter" : sentido),
    },
  });
  return executarRegistrando(op, pedido.urlConcluida);
}

// ── Execução (pedido novo ou retomada) ──────────────────────────────────────

async function executar(op: StripeOperacao, urlConcluida: string | null): Promise<ResultadoPedido> {
  switch (op.tipo) {
    case "upgrade":
      return executarUpgrade(op, urlConcluida);
    case "downgrade":
      return executarDowngrade(op, urlConcluida);
    case "manter":
      return executarManter(op, urlConcluida);
    case "cancelar_substituida":
      await executarCancelamentoDaSubstituida(op);
      return { tipo: "troca", situacao: "sem_mudanca", url: urlConcluida };
    case "checkout":
      // Caiu entre gravar a operação e guardar a sessão: o link nunca chegou ao
      // app, ninguém pode pagá-lo, e a sessão expira sozinha.
      await marcar(op, "descartada", { erro: "checkout_interrompido" });
      return recusado(503, "TENTE_NOVAMENTE", "Não foi possível iniciar a assinatura. Tente novamente.");
    default:
      await marcar(op, "falhou", { erro: `tipo desconhecido: ${op.tipo}` });
      return recusado(500, "OPERACAO_INVALIDA", "Operação inválida.");
  }
}

/**
 * Executa e grava o erro na operação. Transitório (rede, 5xx, banco): continua
 * `pendente` e o erro sobe. Permanente (requisição inválida): `falhou`, sem
 * cobrança, e o pedido é recusado.
 */
async function executarRegistrando(op: StripeOperacao, urlConcluida: string | null): Promise<ResultadoPedido> {
  try {
    return await executar(op, urlConcluida);
  } catch (err) {
    const permanente = erroPermanente(err);
    await marcar(op, permanente ? "falhou" : "pendente", { erro: resumoDoErro(err) }).catch(() => {});
    if (!permanente) throw err;
    console.error("[troca-plano] operação falhou de vez; ver StripeOperacao:", op.id, resumoDoErro(err));
    return recusado(409, "TROCA_INDISPONIVEL", "Não foi possível alterar o plano agora. Fale com o suporte.");
  }
}

async function marcar(op: StripeOperacao, status: string, extra: Partial<Pick<StripeOperacao, "referencia" | "url" | "erro" | "externalId">> = {}) {
  await prisma.stripeOperacao.update({ where: { id: op.id }, data: { status, ...extra } });
}

/** A troca está na assinatura: o plano da linha acompanha (por versão) e a operação termina. */
async function concluir(op: StripeOperacao, sub: Stripe.Subscription, plano: PlanDef, referencia?: string | null) {
  await sincronizarPlanoStripe(sub.id, plano, versaoDoPlanoStripe(sub.metadata));
  await marcar(op, "concluida", { erro: null, ...(referencia ? { referencia } : {}) });
}

function planoDaOperacao(op: StripeOperacao): PlanDef | null {
  return op.planId && op.planId in PLANS ? PLANS[op.planId as keyof typeof PLANS] : null;
}

async function assinaturaDaOperacao(op: StripeOperacao): Promise<{ sub: Stripe.Subscription; alvo: PlanDef } | null> {
  const alvo = planoDaOperacao(op);
  const sub = op.externalId ? await buscarAssinatura(op.externalId) : null;
  if (!alvo || !sub || !VIVAS.has(sub.status)) {
    await marcar(op, "descartada", { erro: !alvo ? "plano_invalido" : "assinatura_nao_viva" });
    return null;
  }
  return { sub, alvo };
}

async function liberarAgenda(sub: Stripe.Subscription, op: StripeOperacao) {
  const agenda = idDe(sub.schedule);
  if (!agenda) return;
  try {
    await stripe.subscriptionSchedules.release(agenda, {}, { idempotencyKey: `${op.chave}:liberar` });
  } catch (err) {
    const atual = await stripe.subscriptionSchedules.retrieve(agenda);
    if (atual.status !== "released" && atual.status !== "completed" && atual.status !== "canceled") throw err;
  }
}

/** Anula a fatura da troca pendente: é assim que a Stripe desfaz uma pending update. */
async function anularTrocaPendente(sub: Stripe.Subscription, op: StripeOperacao) {
  if (!sub.pending_update) return;
  const fatura = idDe(sub.latest_invoice);
  if (!fatura) return;
  try {
    await stripe.invoices.voidInvoice(fatura, {}, { idempotencyKey: `${op.chave}:anular` });
  } catch (err) {
    const atual = await stripe.invoices.retrieve(fatura);
    if (atual.status !== "void") throw err;
  }
}

async function executarUpgrade(op: StripeOperacao, urlConcluida: string | null): Promise<ResultadoPedido> {
  const achada = await assinaturaDaOperacao(op);
  if (!achada) return recusado(409, "ASSINATURA_ALTERADA", "Sua assinatura mudou. Abra os planos novamente.");
  const { sub, alvo } = achada;
  const preco = await precoDoPlano(alvo);

  // Retomada: a Stripe já aplicou (ou já espera o pagamento) — nada a cobrar de novo.
  if (precoDoItem(sub) === preco && !sub.pending_update) {
    await concluir(op, sub, alvo);
    return { tipo: "troca", situacao: "aplicada", url: urlConcluida };
  }
  if (precoPendente(sub) === preco) return aguardarPagamento(op, sub.latest_invoice as Stripe.Invoice | null);

  await liberarAgenda(sub, op);
  const atualizada = await stripe.subscriptions.update(
    sub.id,
    {
      items: [{ id: sub.items.data[0].id, price: preco }],
      proration_behavior: "always_invoice",
      payment_behavior: "pending_if_incomplete",
      metadata: metadadosDoPlano(op.userId, alvo, op.versao ?? versaoDoPlanoStripe(sub.metadata) + 1),
      expand: ["latest_invoice"],
    },
    { idempotencyKey: `${op.chave}:atualizar` },
  );

  if (precoDoItem(atualizada) === preco && !atualizada.pending_update) {
    await concluir(op, atualizada, alvo, idDe(atualizada.latest_invoice));
    return { tipo: "troca", situacao: "aplicada", url: urlConcluida };
  }
  return aguardarPagamento(op, atualizada.latest_invoice as Stripe.Invoice | null);
}

/** Pagamento recusado, com autenticação ou pendente: a troca espera; o plano anterior segue. */
async function aguardarPagamento(op: StripeOperacao, fatura: Stripe.Invoice | null): Promise<ResultadoPedido> {
  const url = fatura?.hosted_invoice_url ?? null;
  await marcar(op, "aguardando", { referencia: fatura?.id ?? null, url, erro: null });
  return { tipo: "troca", situacao: "aguardando_pagamento", url };
}

async function executarDowngrade(op: StripeOperacao, urlConcluida: string | null): Promise<ResultadoPedido> {
  const achada = await assinaturaDaOperacao(op);
  if (!achada) return recusado(409, "ASSINATURA_ALTERADA", "Sua assinatura mudou. Abra os planos novamente.");
  const { sub, alvo } = achada;
  const preco = await precoDoPlano(alvo);

  if (precoDoItem(sub) === preco && !sub.pending_update) {
    await concluir(op, sub, alvo);
    return { tipo: "troca", situacao: "aplicada", url: urlConcluida };
  }
  // Upgrade ainda não pago e agora um downgrade: o último pedido vale.
  await anularTrocaPendente(sub, op);

  let agenda = sub.schedule && typeof sub.schedule === "object" ? sub.schedule : null;
  if (!agenda || !["active", "not_started"].includes(agenda.status)) {
    agenda = await stripe.subscriptionSchedules.create({ from_subscription: sub.id }, { idempotencyKey: `${op.chave}:agendar` });
  }
  // Fase atual pela própria Stripe (não pelo relógio do servidor: o da
  // assinatura pode ser outro, como num relógio de teste).
  const indice = agenda.phases.findIndex((f) => f.start_date === agenda!.current_phase?.start_date);
  const faseAtual = agenda.phases[indice];
  if (!faseAtual) throw new Error(`agenda ${agenda.id} sem fase atual`);

  const proxima = agenda.phases[indice + 1];
  if (!(proxima && idDe(proxima.items?.[0]?.price) === preco)) {
    agenda = await stripe.subscriptionSchedules.update(
      agenda.id,
      {
        end_behavior: "release",
        phases: [
          {
            items: faseAtual.items.map((i) => ({ price: idDe(i.price)!, quantity: i.quantity ?? 1 })),
            start_date: faseAtual.start_date,
            end_date: faseAtual.end_date,
            metadata: faseAtual.metadata ?? {},
          },
          {
            items: [{ price: preco, quantity: 1 }],
            metadata: metadadosDoPlano(op.userId, alvo, op.versao ?? versaoDoPlanoStripe(sub.metadata) + 1),
            duration: { interval: alvo.interval, interval_count: 1 },
            proration_behavior: "none",
          },
        ],
      },
      { idempotencyKey: `${op.chave}:fases` },
    );
  }
  await marcar(op, "concluida", { referencia: agenda.id, erro: null });
  return { tipo: "troca", situacao: "agendada", url: urlConcluida, vigenteEm: new Date(faseAtual.end_date * 1000) };
}

/** Pedido do plano atual: desfaz troca pendente e downgrade agendado. */
async function executarManter(op: StripeOperacao, urlConcluida: string | null): Promise<ResultadoPedido> {
  const achada = await assinaturaDaOperacao(op);
  if (!achada) return recusado(409, "ASSINATURA_ALTERADA", "Sua assinatura mudou. Abra os planos novamente.");
  const { sub, alvo } = achada;
  await anularTrocaPendente(sub, op);
  await liberarAgenda(sub, op);
  await concluir(op, sub, alvo);
  return { tipo: "troca", situacao: "sem_mudanca", url: urlConcluida };
}

/**
 * O vínculo passou para outra `sub_` (duas abas, legado): a anterior deixa de
 * renovar no fim do período já pago, sem estorno. SÓ depois de confirmar na
 * Stripe que a nova está paga e pertence ao mesmo usuário — e que a antiga não
 * é de outra pessoa. Nova ainda sem pagamento: a operação fica pendente.
 */
async function executarCancelamentoDaSubstituida(op: StripeOperacao): Promise<void> {
  const nova = op.externalId ? await buscarAssinatura(op.externalId) : null;
  const antiga = op.substituida ? await buscarAssinatura(op.substituida) : null;

  if (!nova || nova.metadata?.userId !== op.userId) {
    console.error("[troca-plano] assinatura nova não é deste usuário; a antiga NÃO foi cancelada:", op.id);
    await marcar(op, "falhou", { erro: "nova_de_outro_usuario" });
    return;
  }
  const fatura = nova.latest_invoice as Stripe.Invoice | null;
  if (!VIVAS.has(nova.status) || fatura?.status !== "paid") {
    await marcar(op, "pendente", { erro: "nova_nao_paga" });
    return;
  }
  if (!antiga || antiga.status === "canceled" || antiga.status === "incomplete_expired" || antiga.cancel_at_period_end) {
    await marcar(op, "concluida", { erro: null });
    return;
  }
  const donoAntiga = antiga.metadata?.userId;
  if (donoAntiga && donoAntiga !== op.userId) {
    console.error("[troca-plano] assinatura substituída é de outro usuário; NÃO cancelada:", op.id);
    await marcar(op, "falhou", { erro: "antiga_de_outro_usuario" });
    return;
  }

  await liberarAgenda(antiga, op);
  await stripe.subscriptions.update(
    antiga.id,
    { cancel_at_period_end: true, metadata: { substituidaPor: nova.id } },
    { idempotencyKey: `${op.chave}:cancelar` },
  );
  await marcar(op, "concluida", { erro: null });
}

// ── Retomada ────────────────────────────────────────────────────────────────

export type FiltroRetomada = { userId?: string; externalId?: string };

/** Operações `pendente` (falha no meio, ou substituída esperando o pagamento da nova). */
async function pendentes(filtro: FiltroRetomada, limite = 20) {
  return prisma.stripeOperacao.findMany({
    where: {
      status: "pendente",
      ...(filtro.userId ? { userId: filtro.userId } : {}),
      ...(filtro.externalId ? { OR: [{ externalId: filtro.externalId }, { substituida: filtro.externalId }] } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: limite,
  });
}

async function retomarUma(op: StripeOperacao): Promise<void> {
  await prisma.stripeOperacao.update({ where: { id: op.id }, data: { tentativas: { increment: 1 } } });
  await executarRegistrando(op, null);
}

/** Já dentro da trava do usuário (o pedido de plano). */
async function retomarNaTrava(filtro: FiltroRetomada) {
  for (const op of await pendentes(filtro)) await retomarUma(op);
}

/**
 * Retoma operações pendentes — dos eventos da Stripe e da rota de operações.
 * Cada uma sob a trava do seu usuário. Erro transitório PROPAGA (o webhook
 * responde 500 e a Stripe reenvia); a operação continua gravada como pendente.
 */
export async function retomarOperacoes(filtro: FiltroRetomada, limite = 20): Promise<{ retomadas: number }> {
  const ops = await pendentes(filtro, limite);
  let erro: unknown = null;
  for (const op of ops) {
    try {
      await comTravaDoUsuario(op.userId, async () => {
        const atual = await prisma.stripeOperacao.findUnique({ where: { id: op.id } });
        if (atual?.status === "pendente") await retomarUma(atual);
      });
    } catch (err) {
      erro ??= err;
    }
  }
  if (erro) throw erro;
  return { retomadas: ops.length };
}

// ── Anotações vindas dos eventos ────────────────────────────────────────────

/** Retrato da assinatura com a troca aplicada: a operação que esperava pagamento termina. */
export async function marcarTrocasAplicadas(externalId: string, planId: string, versao: number) {
  await prisma.stripeOperacao.updateMany({
    where: { externalId, tipo: "upgrade", status: "aguardando", planId, versao: { lte: versao } },
    data: { status: "concluida", erro: null },
  });
}

/** A Stripe descartou a troca não paga (23 h ou fatura anulada). */
export async function marcarTrocasExpiradas(externalId: string) {
  await prisma.stripeOperacao.updateMany({
    where: { externalId, tipo: "upgrade", status: "aguardando" },
    data: { status: "descartada", erro: "troca_nao_paga_expirou" },
  });
}

/** Sessão de checkout paga ou expirada. */
export async function marcarCheckout(sessaoId: string, status: "concluida" | "descartada", externalId: string | null) {
  await prisma.stripeOperacao.updateMany({
    where: { referencia: sessaoId, tipo: "checkout", status: { in: ["aguardando", "pendente"] } },
    data: { status, ...(externalId ? { externalId } : {}) },
  });
}
