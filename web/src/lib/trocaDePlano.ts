import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe, PLANS, planoPorProdutoDaLoja, type PlanDef } from "@/lib/stripe";
import {
  novaChaveDeOperacao,
  sincronizarPlanoStripe,
  versaoDoPlanoStripe,
} from "@/lib/assinatura";
import { registrarRevisao, type CasoDeRevisao } from "@/lib/revisaoStripe";
import { registrarPresenca } from "@/lib/origemDoCheckout";
import { loja, situacaoCompleta, type LojaProvedor, type SituacaoNaLoja } from "@/lib/lojas";
import { assertContaAtiva } from "@/lib/contaAtiva";
import { Prisma, type AssinaturaLoja, type StripeOperacao } from "@prisma/client";

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

/** Pedidos da mesma pessoa, um de cada vez, e prazos da retomada. Mutável só para os testes. */
export const limitesTroca = {
  lockTimeoutMs: 10_000,
  maxWaitMs: 5_000,
  timeoutMs: 45_000,
  /** Pedido que não chegou à Stripe e passou disto é DESCARTADO, nunca executado tarde. */
  validadePedidoMs: 10 * 60_000,
  /** `pendente` sem mudança há mais que isto não está em andamento (o pedido dura no máximo `timeoutMs`). */
  paradaMs: 60_000,
  /** Intervalo mínimo entre duas conferências de uma `aguardando` na Stripe. */
  revisaoAguardandoMs: 10 * 60_000,
  /** Duração máxima da transação de uma rodada de varredura (a trava global solta no fim). */
  timeoutVarreduraMs: 50_000,
  /** Depois disto a rodada não começa operação nova (cabe no `maxDuration` de 60 s do cron). */
  orcamentoVarreduraMs: 40_000,
  /**
   * As travas (do usuário e da varredura) vivem numa transação OCIOSA enquanto
   * o trabalho roda em outras conexões. Numa instância serverless congelada, o
   * timeout do Prisma (timer do JS) congela junto; o do Postgres não: passado
   * isto, ele encerra a sessão e a trava é solta.
   */
  ociosoUsuarioMs: 50_000,
  ociosoVarreduraMs: 55_000,
};

export class OperacaoEmAndamento extends Error {}

/**
 * Lock consultivo da pessoa, numa transação que só segura a trava. As escritas
 * de dentro usam o client global e são confirmadas na hora: a operação fica
 * gravada antes da chamada à Stripe mesmo que o processo caia no meio.
 */
export async function comTravaDoUsuario<T>(userId: string, fn: () => Promise<T>, esperaMs = limitesTroca.lockTimeoutMs): Promise<T> {
  const { maxWaitMs, timeoutMs, ociosoUsuarioMs } = limitesTroca;
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('lock_timeout', ${String(esperaMs)}, true), set_config('idle_in_transaction_session_timeout', ${String(ociosoUsuarioMs)}, true)`;
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
  await registrarPresenca();
  return comTravaDoUsuario(pedido.userId, async () => {
    // A exclusão de conta usa a mesma trava: quem esperou por ela não compra
    // para uma conta que acabou de ser excluída.
    await assertContaAtiva(pedido.userId);
    await retomarNaTrava({ userId: pedido.userId });

    // Assinatura de loja ativa: nenhuma cobrança Stripe nova. Pergunta à loja
    // agora; sem resposta, também não libera (lib/lojas).
    const lojas = await consultarLojasDoUsuario(pedido.userId);
    if (lojas.vigente || lojas.renova) {
      return recusado(409, "ASSINATURA_NA_LOJA", "Sua assinatura é pela App Store ou pelo Google Play. Para mudar de plano, use a loja.");
    }
    if (lojas.desconhecida) {
      return recusado(503, "LOJA_INDISPONIVEL", "Não foi possível confirmar sua assinatura na loja agora. Tente novamente mais tarde.");
    }

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
  const sessao = await stripe.checkout.sessions.create(comOperacao(pedido.checkout, op.chave), { idempotencyKey: `${op.chave}:sessao` });
  if (!sessao.url) throw new Error("sessão de checkout sem url");
  await prisma.stripeOperacao.update({
    where: { id: op.id },
    data: { status: "aguardando", referencia: sessao.id, url: sessao.url },
  });
  return { tipo: "checkout", url: sessao.url };
}

/**
 * A chave da operação vai nos metadados da sessão E da assinatura: é a prova
 * de que a sessão saiu desta rota para este usuário (lib/origemDoCheckout).
 */
function comOperacao(params: Stripe.Checkout.SessionCreateParams, chave: string): Stripe.Checkout.SessionCreateParams {
  return {
    ...params,
    metadata: { ...params.metadata, operacao: chave },
    ...(params.subscription_data
      ? { subscription_data: { ...params.subscription_data, metadata: { ...params.subscription_data.metadata, operacao: chave } } }
      : {}),
  };
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
    case "encerrar_por_loja":
      await executarEncerramentoPorLoja(op);
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

const NUNCA_DESISTE = new Set(["cancelar_substituida", "encerrar_por_loja"]);

/**
 * Executa e grava o erro na operação. Transitório (rede, 5xx, banco): continua
 * `pendente` e o erro sobe. Permanente (requisição inválida): `falhou`, sem
 * cobrança, e o pedido é recusado. O cancelamento da substituída e o
 * encerramento pela loja nunca desistem sozinhos — desistir deixaria a antiga
 * renovar —: seguem `pendente` com o erro.
 */
async function executarRegistrando(op: StripeOperacao, urlConcluida: string | null): Promise<ResultadoPedido> {
  try {
    return await executar(op, urlConcluida);
  } catch (err) {
    const permanente = !NUNCA_DESISTE.has(op.tipo) && erroPermanente(err);
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

/**
 * Pedido antigo que a releitura mostrou não ter chegado à Stripe: quem pediu
 * já não está esperando. Executá-lo agora seria cobrar tarde algo que ninguém
 * confirmou de novo — descarta; a pessoa pede outra vez se ainda quiser.
 */
const pedidoVencido = (op: StripeOperacao) => Date.now() - op.createdAt.getTime() > limitesTroca.validadePedidoMs;

async function descartarVencido(op: StripeOperacao): Promise<ResultadoPedido> {
  await marcar(op, "descartada", { erro: "pedido_vencido_sem_efeito" });
  return recusado(409, "PEDIDO_EXPIRADO", "Seu pedido expirou sem ser concluído. Abra os planos novamente.");
}

/** Fase atual (pela própria Stripe, não pelo relógio do servidor) e a seguinte. */
function fasesDaAgenda(agenda: Stripe.SubscriptionSchedule) {
  const indice = agenda.phases.findIndex((f) => f.start_date === agenda.current_phase?.start_date);
  return { faseAtual: agenda.phases[indice], proxima: indice >= 0 ? agenda.phases[indice + 1] : undefined };
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
  if (pedidoVencido(op)) return descartarVencido(op);

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
  let agenda = sub.schedule && typeof sub.schedule === "object" && ["active", "not_started"].includes(sub.schedule.status) ? sub.schedule : null;
  const jaAgendada = agenda ? fasesDaAgenda(agenda) : null;
  if (agenda && jaAgendada?.faseAtual && idDe(jaAgendada.proxima?.items?.[0]?.price) === preco) {
    await marcar(op, "concluida", { referencia: agenda.id, erro: null });
    return { tipo: "troca", situacao: "agendada", url: urlConcluida, vigenteEm: new Date(jaAgendada.faseAtual.end_date * 1000) };
  }
  if (pedidoVencido(op)) return descartarVencido(op);

  // Upgrade ainda não pago e agora um downgrade: o último pedido vale.
  await anularTrocaPendente(sub, op);
  if (!agenda) {
    agenda = await stripe.subscriptionSchedules.create({ from_subscription: sub.id }, { idempotencyKey: `${op.chave}:agendar` });
  }
  const { faseAtual, proxima } = fasesDaAgenda(agenda);
  if (!faseAtual) throw new Error(`agenda ${agenda.id} sem fase atual`);

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
  // Vencido: desfazer agora poderia apagar o que a pessoa agendou depois.
  if (pedidoVencido(op)) return descartarVencido(op);
  await anularTrocaPendente(sub, op);
  await liberarAgenda(sub, op);
  await concluir(op, sub, alvo);
  return { tipo: "troca", situacao: "sem_mudanca", url: urlConcluida };
}

/** Renovação ainda não paga: o período que a assinatura tinha pago já terminou. */
const RENOVACAO_NAO_PAGA = new Set<string>(["draft", "open", "uncollectible"]);
const ENCERRADAS = new Set<string>(["canceled", "incomplete_expired"]);

/**
 * O vínculo passou para outra `sub_` (duas abas, legado): a anterior NUNCA
 * renova depois do período que já pagou, e nada é estornado automaticamente.
 *
 * Antes de qualquer escrita na Stripe, as provas:
 *  - a nova é do mesmo usuário e está paga (sem pagamento, espera; encerrada, descarta);
 *  - a antiga tem nos metadados o MESMO dono — sem dono provado, não é cancelada;
 *  - a antiga não é o vínculo atual da pessoa.
 *
 * Depois, pelas faturas de RENOVAÇÃO (`subscription_cycle`) da antiga:
 *  - paga DEPOIS da substituição: a cobrança indevida já aconteceu → caso de
 *    revisão manual (StripeRevisao), gravado antes de qualquer outra escrita;
 *  - não paga (rascunho, aberta, incobrável): o período pago acabou → cancela
 *    JÁ, sem prorrateio nem fatura nova, e neutraliza CADA fatura. Cancelar a
 *    assinatura não prova que uma fatura existente não será cobrada;
 *  - nenhuma não paga: cancela no fim do período pago — o que ela pagou, mesmo
 *    que indevidamente, segue até o fim; a revisão decide o estorno.
 */
async function executarCancelamentoDaSubstituida(op: StripeOperacao): Promise<void> {
  const nova = op.externalId ? await buscarAssinatura(op.externalId) : null;
  if (!nova || nova.metadata?.userId !== op.userId) {
    console.error("[troca-plano] assinatura nova não é deste usuário; a antiga NÃO foi cancelada:", op.id);
    await marcar(op, "falhou", { erro: "nova_de_outro_usuario" });
    return;
  }
  const faturaDaNova = nova.latest_invoice as Stripe.Invoice | null;
  if (!VIVAS.has(nova.status) || faturaDaNova?.status !== "paid") {
    // Nova encerrada sem pagamento: não há o que substituir; a antiga segue.
    const encerrada = ENCERRADAS.has(nova.status);
    await marcar(op, encerrada ? "descartada" : "pendente", { erro: encerrada ? "nova_encerrada_sem_pagamento" : "nova_nao_paga" });
    return;
  }

  const antiga = op.substituida && op.substituida !== nova.id ? await buscarAssinatura(op.substituida) : null;
  if (!antiga) {
    await marcar(op, "concluida", { erro: null });
    return;
  }
  if (antiga.metadata?.userId !== op.userId) {
    const erro = antiga.metadata?.userId ? "antiga_de_outro_usuario" : "antiga_sem_dono_provado";
    console.error("[troca-plano] assinatura substituída sem o mesmo dono; NÃO cancelada:", op.id, erro);
    await marcar(op, "falhou", { erro });
    return;
  }
  const vinculo = await prisma.subscription.findUnique({ where: { userId: op.userId }, select: { provider: true, externalId: true } });
  if (vinculo?.provider === "STRIPE" && vinculo.externalId === antiga.id) {
    await marcar(op, "descartada", { erro: "antiga_e_o_vinculo_atual" });
    return;
  }

  const desde = await momentoDaSubstituicao(op);
  const pagas = await encerrarNoFimDoPeriodo(op, antiga, desde, {
    motivo: { comentario: `substituida_por ${nova.id}`, metadata: { substituidaPor: nova.id } },
    revisar: (f) => registrarRenovacaoPaga(op, nova.id, antiga.id, f),
  });
  await marcar(op, "concluida", { erro: pagas > 0 ? "renovacao_paga_em_revisao" : null });
}

type MotivoDoEncerramento = { comentario: string; metadata: Record<string, string> };

/**
 * A antiga nunca renova depois do período que já pagou, pelas faturas de
 * RENOVAÇÃO (`subscription_cycle`) dela:
 *  - paga DEPOIS de `desde`: a cobrança indevida já aconteceu → `revisar`,
 *    antes de qualquer outra escrita;
 *  - não paga (rascunho, aberta, incobrável): o período pago acabou → cancela
 *    JÁ, sem prorrateio nem fatura nova, e neutraliza CADA fatura;
 *  - nenhuma não paga: cancela no fim do período pago.
 * Devolve quantas renovações pagas foram para revisão.
 */
async function encerrarNoFimDoPeriodo(
  op: StripeOperacao,
  antiga: Stripe.Subscription,
  desde: Date,
  { motivo, revisar }: { motivo: MotivoDoEncerramento; revisar: (fatura: Stripe.Invoice) => Promise<unknown> },
): Promise<number> {
  const renovacoes = (await stripe.invoices.list({ subscription: antiga.id, limit: 100 })).data.filter(
    (f) => f.billing_reason === "subscription_cycle",
  );
  const pagasDepois = renovacoes.filter((f) => f.status === "paid" && pagaEm(f) >= desde.getTime());
  for (const f of pagasDepois) await revisar(f);

  const naoPagas = renovacoes.filter((f) => RENOVACAO_NAO_PAGA.has(f.status ?? ""));
  if (naoPagas.length > 0) {
    await cancelarJa(antiga, motivo.comentario, op);
    for (const f of naoPagas) {
      const final = await neutralizarRenovacao(f.id, op);
      // Paga entre a leitura e a anulação: também é cobrança indevida.
      if (final.status === "paid") {
        await revisar(final);
        pagasDepois.push(final);
      }
    }
  } else if (!ENCERRADAS.has(antiga.status) && !antiga.cancel_at_period_end) {
    await liberarAgenda(antiga, op);
    await stripe.subscriptions.update(
      antiga.id,
      { cancel_at_period_end: true, metadata: motivo.metadata },
      { idempotencyKey: `${op.chave}:cancelar` },
    );
  }
  return pagasDepois.length;
}

/** Quando o vínculo trocou: a primeira operação deste par nova/antiga. */
async function momentoDaSubstituicao(op: StripeOperacao): Promise<Date> {
  const primeira = await prisma.stripeOperacao.findFirst({
    where: { tipo: "cancelar_substituida", userId: op.userId, externalId: op.externalId, substituida: op.substituida },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  return primeira?.createdAt ?? op.createdAt;
}

/** Hora do pagamento (ms); sem ela, a da emissão. */
function pagaEm(fatura: Stripe.Invoice): number {
  return (fatura.status_transitions?.paid_at ?? fatura.created) * 1000;
}

function registrarRenovacaoPaga(
  op: StripeOperacao,
  nova: string | null,
  antiga: string,
  fatura: Stripe.Invoice,
  tipo: CasoDeRevisao["tipo"] = "renovacao_paga_da_substituida",
) {
  return registrarRevisao({
    tipo,
    chave: `renovacao_paga:${fatura.id}`,
    userId: op.userId,
    assinatura: nova,
    substituida: antiga,
    faturaId: fatura.id,
    valor: fatura.amount_paid,
    moeda: fatura.currency,
    motivo: `renovação paga em ${new Date(pagaEm(fatura)).toISOString()}, depois da ${nova ? "substituição" : "compra na loja"}; sem estorno automático`,
  });
}

/** Cancela já: o período pago acabou. Sem prorrateio e sem fatura final. */
async function cancelarJa(antiga: Stripe.Subscription, comentario: string, op: StripeOperacao) {
  if (ENCERRADAS.has(antiga.status)) return;
  await liberarAgenda(antiga, op);
  try {
    await stripe.subscriptions.cancel(
      antiga.id,
      { prorate: false, invoice_now: false, cancellation_details: { comment: comentario } },
      { idempotencyKey: `${op.chave}:cancelar_ja` },
    );
  } catch (err) {
    const atual = await buscarAssinatura(antiga.id);
    if (!atual || !ENCERRADAS.has(atual.status)) throw err;
  }
}

/**
 * Tira a fatura de renovação da cobrança, de forma verificável: fatura de
 * assinatura não pode ser apagada, então o rascunho sai da cobrança automática,
 * é finalizado SEM cobrança e anulado; a aberta (ou incobrável) é anulada.
 * Devolve a fatura relida: `void`, ou `paid` se a Stripe cobrou antes.
 */
async function neutralizarRenovacao(faturaId: string, op: StripeOperacao): Promise<Stripe.Invoice> {
  let fatura = await stripe.invoices.retrieve(faturaId);
  if (fatura.status === "draft") {
    if (fatura.auto_advance) {
      fatura = await stripe.invoices.update(faturaId, { auto_advance: false }, { idempotencyKey: `${op.chave}:sem_cobranca:${faturaId}` });
    }
    fatura = await stripe.invoices.finalizeInvoice(faturaId, { auto_advance: false }, { idempotencyKey: `${op.chave}:finalizar:${faturaId}` });
  }
  if (fatura.status === "open" || fatura.status === "uncollectible") {
    try {
      fatura = await stripe.invoices.voidInvoice(faturaId, {}, { idempotencyKey: `${op.chave}:anular:${faturaId}` });
    } catch (err) {
      fatura = await stripe.invoices.retrieve(faturaId);
      if (fatura.status !== "void" && fatura.status !== "paid") throw err;
    }
  }
  if (fatura.status !== "void" && fatura.status !== "paid") {
    throw new Error(`fatura ${faturaId} da assinatura substituída segue ${fatura.status}`);
  }
  return fatura;
}

/**
 * Renovação (fatura de ciclo) de uma assinatura que FOI substituída: grava uma
 * operação `cancelar_substituida` só desta fatura (chave por fatura: reentrega
 * não duplica) e a deixa pendente para a execução. Tudo durável antes de a
 * rota responder à Stripe. Devolve se a assinatura é substituída.
 */
export async function registrarRenovacaoDaSubstituida(substituida: string, faturaId: string): Promise<boolean> {
  const origem = await prisma.stripeOperacao.findFirst({
    where: { tipo: "cancelar_substituida", substituida, status: { in: ["pendente", "concluida"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!origem) return false;
  await prisma.stripeOperacao.createMany({
    data: [
      {
        userId: origem.userId,
        tipo: "cancelar_substituida",
        status: "pendente",
        externalId: origem.externalId,
        substituida,
        referencia: faturaId,
        chave: `dular-renovacao-${faturaId}`,
      },
    ],
    skipDuplicates: true,
  });
  return true;
}

// ── Loja (App Store / Google Play) ──────────────────────────────────────────
//
// Regras do dono (issue #359):
//  1. Compra válida na loja prevalece: a Stripe encerra ao fim do período pago,
//     sem estorno automático.
//  2. Checkout Stripe é recusado enquanto a assinatura da loja estiver ativa.
//  3. Pagamento Stripe que chegar com a loja vigente: cancelamento seguro da
//     Stripe e caso de revisão manual.
// Só a Stripe é encerrada pelo servidor: a App Store Server API não cancela
// assinatura (quem cancela é a pessoa, no aparelho). Liberar cobrança ou
// cancelar exige a loja consultada AGORA; sem resposta, nada é liberado nem
// cancelado, e o gravado nunca prova que a loja parou de cobrar.
//
// Quem decide é a situação ATUAL da compra na loja, nunca a data original:
//  - em período pago E renovando: a loja prevalece e a Stripe encerra, mesmo
//    que a compra da loja seja anterior ao vínculo Stripe (as duas seguiriam
//    cobrando; a data só vira caso de revisão);
//  - em período, SEM renovação (cancelada na loja): não há segunda cobrança
//    recorrente; a Stripe, única que renova, não é encerrada. Fica em espera:
//    se a renovação voltar, encerra; se a loja terminar, descarta;
//  - fora do período (comprovante antigo): não concede nem encerra nada.

export type SituacaoDasLojas = {
  compras: number;
  /** Alguma compra em período pago E renovando: a loja prevalece. */
  prevalece: boolean;
  /** Alguma compra com período pago em curso, segundo a loja agora. */
  vigente: boolean;
  /** Alguma compra que a loja ainda vai renovar. */
  renova: boolean;
  /** Alguma compra sem resposta da loja. */
  desconhecida: boolean;
};

function estadoNaLoja(s: SituacaoNaLoja) {
  const plano = planoPorProdutoDaLoja(s.storeProductId);
  return {
    vigente: s.vigente,
    renova: s.renova,
    expiraEm: s.expiraEm,
    verificadaEm: new Date(),
    ...(plano ? { storeProductId: s.storeProductId, plan: plano.plan } : {}),
  };
}

/** Pergunta à loja, agora, por cada compra de loja da pessoa, e guarda a resposta. */
export async function consultarLojasDoUsuario(userId: string): Promise<SituacaoDasLojas> {
  const compras = await prisma.assinaturaLoja.findMany({ where: { userId }, select: { id: true, provider: true, externalId: true } });
  const situacao: SituacaoDasLojas = { compras: compras.length, prevalece: false, vigente: false, renova: false, desconhecida: false };
  for (const compra of compras) {
    try {
      const s: unknown = await loja.consultar(compra.provider as LojaProvedor, compra.externalId);
      // Resposta incompleta vale o mesmo que loja fora do ar: desconhecida.
      if (!situacaoCompleta(s)) throw new Error("resposta incompleta da loja");
      if (s.externalId !== compra.externalId) throw new Error("a loja respondeu por outra compra");
      await prisma.assinaturaLoja.update({ where: { id: compra.id }, data: estadoNaLoja(s) });
      situacao.prevalece ||= s.vigente && s.renova;
      situacao.vigente ||= s.vigente;
      situacao.renova ||= s.renova;
    } catch (err) {
      situacao.desconhecida = true;
      console.error("[loja] situação da compra indisponível; nada é liberado nem cancelado por ela:", compra.id, resumoDoErro(err));
    }
  }
  return situacao;
}

export type ResultadoCompraDeLoja = "registrada" | "vencida" | "de_outra_conta";

/**
 * Compra de loja já verificada pela loja, com a titularidade conferida pela
 * rota. Sob a trava da pessoa (a mesma do checkout e do vínculo pelo webhook):
 *  - registra a compra — uma por conta, nunca apagada — sem tocar o vínculo
 *    Stripe; a mesma compra reapresentada só atualiza o estado;
 *  - compra que a loja diz fora do período: fica no histórico e não concede nada;
 *  - compra que vale: regra 1 (`encerrarStripePelaLoja`), tentada já; se a
 *    Stripe falhar, a operação segue pendente e a compra não é recusada.
 */
export async function registrarCompraDaLoja(
  userId: string,
  provider: LojaProvedor,
  situacao: SituacaoNaLoja,
  plano: PlanDef,
): Promise<ResultadoCompraDeLoja> {
  return comTravaDoUsuario(userId, async () => {
    // Conta excluída enquanto a compra esperava pela trava: nada é gravado.
    await assertContaAtiva(userId);
    const existente = await prisma.assinaturaLoja.findUnique({
      where: { provider_externalId: { provider, externalId: situacao.externalId } },
    });
    if (existente && existente.userId !== userId) return "de_outra_conta";
    const estado = { ...estadoNaLoja(situacao), storeProductId: situacao.storeProductId, plan: plano.plan };
    let compra: AssinaturaLoja;
    if (existente) {
      compra = await prisma.assinaturaLoja.update({ where: { id: existente.id }, data: estado });
    } else {
      try {
        compra = await prisma.assinaturaLoja.create({
          data: { userId, provider, externalId: situacao.externalId, compradaEm: situacao.compradaEm, ...estado },
        });
      } catch (err) {
        // Outra conta registrou a mesma compra ao mesmo tempo: o índice único decide.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return "de_outra_conta";
        throw err;
      }
    }
    if (!situacao.vigente) return "vencida";

    await encerrarStripePelaLoja(compra);
    try {
      await retomarNaTrava({ userId });
    } catch (err) {
      console.error("[loja] encerramento da Stripe segue gravado para a retomada:", userId, resumoDoErro(err));
    }
    return "registrada";
  });
}

/**
 * Regra 1: grava o encerramento do vínculo Stripe. Quem decide se ele acontece
 * é a execução, pela situação atual na loja — não a data da compra.
 */
async function encerrarStripePelaLoja(compra: AssinaturaLoja) {
  const vinculo = await prisma.subscription.findUnique({ where: { userId: compra.userId }, select: { provider: true, externalId: true } });
  if (vinculo?.provider !== "STRIPE" || !vinculo.externalId?.startsWith("sub_")) return;
  const sub = vinculo.externalId;
  await prisma.stripeOperacao.createMany({
    data: [{ userId: compra.userId, tipo: "encerrar_por_loja", status: "pendente", substituida: sub, referencia: compra.id, chave: `dular-loja-${compra.id}-encerra-${sub}` }],
    skipDuplicates: true,
  });
}

/**
 * A assinatura Stripe encerra porque a loja prevalece (regras 1 e 3). Antes de
 * qualquer escrita na Stripe:
 *  - a loja, consultada agora, diz que uma compra da pessoa está em período
 *    pago E renovando. Sem resposta, em período sem renovação, ou renovando
 *    sem período: espera, nada é cancelado. Fora do período e sem renovação:
 *    a Stripe segue, a operação é descartada;
 *  - a assinatura Stripe tem nos metadados o MESMO dono (o controle do #348).
 * Vira caso de revisão (nada é estornado): o pagamento Stripe que chegou com
 * a loja ativa (regra 3), a renovação Stripe paga depois da compra na loja, e
 * a compra de loja ANTERIOR à assinatura Stripe — as duas cobraram juntas.
 */
async function executarEncerramentoPorLoja(op: StripeOperacao): Promise<void> {
  const lojas = await consultarLojasDoUsuario(op.userId);
  if (!lojas.prevalece) {
    const espera = lojas.desconhecida
      ? "loja_indisponivel"
      : lojas.vigente
        ? "loja_em_periodo_sem_renovacao"
        : lojas.renova
          ? "loja_renovando_sem_periodo"
          : null;
    if (espera) await marcar(op, "pendente", { erro: espera });
    else await marcar(op, "descartada", { erro: "loja_nao_vigente" });
    return;
  }

  const antiga = op.substituida ? await buscarAssinatura(op.substituida) : null;
  if (!antiga) {
    await marcar(op, "concluida", { erro: null });
    return;
  }
  if (antiga.metadata?.userId !== op.userId) {
    const erro = antiga.metadata?.userId ? "antiga_de_outro_usuario" : "antiga_sem_dono_provado";
    console.error("[troca-plano] assinatura Stripe sem o mesmo dono; NÃO encerrada pela loja:", op.id, erro);
    await marcar(op, "falhou", { erro });
    return;
  }

  const anteriores = op.referencia ? await registrarLojaAnterior(op, op.referencia, antiga) : await registrarPagamentoComLoja(op, antiga.id);
  const pagas = await encerrarNoFimDoPeriodo(op, antiga, op.createdAt, {
    motivo: { comentario: "assinatura_na_loja", metadata: { encerradaPorLoja: "1" } },
    revisar: (f) => registrarRenovacaoPaga(op, null, antiga.id, f, "renovacao_paga_com_loja"),
  });
  await marcar(op, "concluida", { erro: anteriores + pagas > 0 ? "cobranca_em_revisao" : null });
}

/**
 * Regra 1 com a compra de loja ANTERIOR à assinatura Stripe: a loja prevalece
 * do mesmo jeito (segue renovando), mas as duas cobraram juntas desde o início
 * da Stripe — caso de revisão.
 */
async function registrarLojaAnterior(op: StripeOperacao, compraId: string, sub: Stripe.Subscription): Promise<number> {
  const compra = await prisma.assinaturaLoja.findUnique({ where: { id: compraId } });
  const inicioStripe = typeof sub.start_date === "number" ? sub.start_date * 1000 : Number.NaN;
  if (!compra || !(compra.compradaEm.getTime() < inicioStripe)) return 0;
  await registrarRevisao({
    tipo: "loja_anterior_ao_vinculo",
    chave: `loja_anterior:${compra.id}:${sub.id}`,
    userId: op.userId,
    assinatura: sub.id,
    motivo: `assinatura ${compra.provider} ${compra.externalId} de ${compra.compradaEm.toISOString()}, anterior à Stripe (${new Date(inicioStripe).toISOString()}), segue renovando; as duas cobraram juntas; a Stripe encerra no fim do período pago; sem estorno automático`,
  });
  return 1;
}

/** Regra 3: a primeira fatura paga da assinatura que chegou com a loja vigente. */
async function registrarPagamentoComLoja(op: StripeOperacao, sub: string): Promise<number> {
  const faturas = (await stripe.invoices.list({ subscription: sub, limit: 100 })).data;
  const primeira = faturas.find((f) => f.billing_reason === "subscription_create" && f.status === "paid");
  if (!primeira) return 0;
  await registrarRevisao({
    tipo: "pagamento_stripe_com_loja",
    chave: `pagamento_com_loja:${primeira.id}`,
    userId: op.userId,
    assinatura: sub,
    faturaId: primeira.id,
    valor: primeira.amount_paid,
    moeda: primeira.currency,
    motivo: "pagamento Stripe com assinatura de loja vigente; a Stripe encerra no fim do período pago; sem estorno automático",
  });
  return 1;
}

/** Há encerramento pela loja pendente para esta `sub_`? (o rascunho da renovação tenta já). */
export async function temEncerramentoPorLojaPendente(sub: string): Promise<boolean> {
  const op = await prisma.stripeOperacao.findFirst({ where: { tipo: "encerrar_por_loja", substituida: sub, status: "pendente" }, select: { id: true } });
  return op !== null;
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
 * Cada uma sob a trava do seu usuário (`esperaMs`: quanto esperar por ela).
 * Erro transitório PROPAGA (o webhook responde 500 e a Stripe reenvia); a
 * operação continua gravada como pendente.
 */
export async function retomarOperacoes(filtro: FiltroRetomada, limite = 20, esperaMs?: number): Promise<{ retomadas: number }> {
  const ops = await pendentes(filtro, limite);
  let erro: unknown = null;
  for (const op of ops) {
    try {
      await comTravaDoUsuario(op.userId, async () => {
        const atual = await prisma.stripeOperacao.findUnique({ where: { id: op.id } });
        if (atual?.status === "pendente") await retomarUma(atual);
      }, esperaMs);
    } catch (err) {
      erro ??= err;
    }
  }
  if (erro) throw erro;
  return { retomadas: ops.length };
}

/**
 * Varredura: o que nenhum pedido nem evento vai acordar. Roda no boot de cada
 * servidor e em intervalo (lib/varreduraDeOperacoes), e pela rota de operações.
 *  - `pendente` parada (o processo caiu, a Stripe ficou fora): relê a Stripe e
 *    conclui; pedido vencido sem efeito é descartado, nunca executado tarde;
 *    cancelamento de substituída é sempre levado até o fim.
 *  - `aguardando`: confere na Stripe — troca paga depois na fatura vira o plano
 *    no banco; troca não paga que expirou e checkout pago/expirado terminam —
 *    sem depender dos eventos.
 * Cada operação sob a trava do seu usuário; erro numa não para as outras (ela
 * segue gravada e volta na próxima rodada).
 *
 * Uma rodada por vez em TODAS as instâncias (boot, intervalo, cron, admin): a
 * trava global não espera — quem chega com outra em andamento sai na hora com
 * `emAndamento`. O cron da plataforma pode entregar a mesma execução duas vezes.
 */
export type ResultadoVarredura = { examinadas: number; falhas: number; emAndamento?: true };

export async function varrerOperacoes(opcoes: { imediato?: boolean; limite?: number } = {}): Promise<ResultadoVarredura> {
  await registrarPresenca();
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('idle_in_transaction_session_timeout', ${String(limitesTroca.ociosoVarreduraMs)}, true)`;
      const [{ livre }] = await tx.$queryRaw<{ livre: boolean }[]>`SELECT pg_try_advisory_xact_lock(7704, 0) AS livre`;
      if (!livre) return { examinadas: 0, falhas: 0, emAndamento: true as const };
      return varrerNaTrava(opcoes);
    },
    { maxWait: limitesTroca.maxWaitMs, timeout: limitesTroca.timeoutVarreduraMs },
  );
}

async function varrerNaTrava(opcoes: { imediato?: boolean; limite?: number }): Promise<ResultadoVarredura> {
  const agora = Date.now();
  const antesDe = (ms: number) => (opcoes.imediato ? {} : { updatedAt: { lt: new Date(agora - ms) } });
  const ops = await prisma.stripeOperacao.findMany({
    where: {
      OR: [
        { status: "pendente", ...antesDe(limitesTroca.paradaMs) },
        { status: "aguardando", ...antesDe(limitesTroca.revisaoAguardandoMs) },
      ],
    },
    orderBy: { updatedAt: "asc" },
    take: opcoes.limite ?? 20,
  });
  let falhas = 0;
  let examinadas = 0;
  for (const op of ops) {
    // O que sobrar fica gravado para a próxima rodada.
    if (Date.now() - agora > limitesTroca.orcamentoVarreduraMs) break;
    examinadas += 1;
    try {
      await comTravaDoUsuario(op.userId, async () => {
        const atual = await prisma.stripeOperacao.findUnique({ where: { id: op.id } });
        // Mexida por outro caminho entre a lista e a trava: fica para a próxima rodada.
        if (!atual || atual.updatedAt.getTime() !== op.updatedAt.getTime()) return;
        if (atual.status === "pendente") await retomarUma(atual);
        else if (atual.status === "aguardando") await reconciliarAguardando(atual);
      });
    } catch (err) {
      falhas += 1;
      console.error("[troca-plano] varredura: operação segue gravada para a próxima rodada:", op.id, resumoDoErro(err));
    }
  }
  return { examinadas, falhas };
}

async function reconciliarAguardando(op: StripeOperacao): Promise<void> {
  const conferida = () => prisma.stripeOperacao.update({ where: { id: op.id }, data: { tentativas: { increment: 1 } } });
  if (op.tipo === "checkout" && op.referencia) {
    const sessao = await stripe.checkout.sessions.retrieve(op.referencia);
    if (sessao.status === "complete") return void (await marcar(op, "concluida", { externalId: idDe(sessao.subscription) }));
    if (sessao.status === "expired") return void (await marcar(op, "descartada", { erro: "checkout_expirou" }));
    return void (await conferida());
  }
  if (op.tipo === "upgrade") {
    const alvo = planoDaOperacao(op);
    const sub = op.externalId ? await buscarAssinatura(op.externalId) : null;
    if (!alvo || !sub) return void (await marcar(op, "descartada", { erro: "assinatura_nao_encontrada" }));
    const preco = await precoDoPlano(alvo);
    if (precoDoItem(sub) === preco && !sub.pending_update) return void (await concluir(op, sub, alvo));
    if (precoPendente(sub) === preco) return void (await conferida());
    return void (await marcar(op, "descartada", { erro: "troca_nao_paga_expirou" }));
  }
  await conferida();
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
