import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { criarStripeFalso, type StripeFalso } from "./_stripeFalso";

/**
 * Troca de plano contra Postgres REAL, com a Stripe SIMULADA em memória
 * (_stripeFalso: idempotência, pending_if_incomplete, agenda, checkout).
 * Testes locais de ORDEM CONTROLADA — não são eventos reais da sandbox.
 *
 * Passa pela rota real de /api/billing/checkout (JWT real), pelo webhook real
 * (HMAC com segredo fictício) e pela rota de operações. A prova de "não cobrou
 * em dobro" é a lista de faturas pagas da Stripe simulada; a de "plano certo",
 * a linha de Subscription e o acesso efetivo.
 *
 * Mesmo protocolo das outras suítes de banco: SAFESCORE_DB_URL local;
 * obrigatório no CI (SAFESCORE_DB_REQUIRED=1).
 */

const URL_BANCO = process.env.SAFESCORE_DB_URL;
const PULAR = !URL_BANCO
  ? "defina SAFESCORE_DB_URL (Postgres local com as migrations aplicadas)"
  : !/@(localhost|127\.0\.0\.1)[:/]/.test(URL_BANCO)
    ? "SAFESCORE_DB_URL não aponta para localhost — recusado"
    : false;
const EXIGIDO = process.env.SAFESCORE_DB_REQUIRED === "1";
const SEGREDO = "whsec_ficticio_troca_plano_db";
const DIA = 86_400;

describe("troca de plano Stripe contra Postgres real", { skip: EXIGIDO ? false : PULAR }, () => {
  let prisma: any;
  let stripeCliente: any;
  let PLANS: any;
  let postCheckout: (req: Request) => Promise<Response>;
  let postWebhook: (req: Request) => Promise<Response>;
  let postOps: (req: Request) => Promise<Response>;
  let makeAuthHeaders: (userId: string, role: any) => Record<string, string>;
  let limitesTransacao: { lockTimeoutMs: number; statementTimeoutMs: number };
  let varrer: (opcoes?: { imediato?: boolean; limite?: number }) => Promise<{ examinadas: number; falhas: number }>;
  let falso: StripeFalso;
  const RUN = `t_troca_${Date.now().toString(36)}`;
  const usuarios: string[] = [];
  let ip = 0;
  let evtSeq = 0;
  let testemunha = "";
  let fotoTestemunha: unknown = null;

  async function usuario(sufixo: string, role = "DIARISTA") {
    const id = `${RUN}_${sufixo}`;
    await prisma.user.create({ data: { id, nome: `Teste troca ${sufixo}`, role } });
    usuarios.push(id);
    return id;
  }

  async function pedir(userId: string, planId: string, role = "DIARISTA") {
    ip += 1;
    const res = await postCheckout(
      new Request("http://test/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": `10.9.${ip >> 8}.${ip & 255}`, ...makeAuthHeaders(userId, role) },
        body: JSON.stringify({ planId }),
      }),
    );
    return { status: res.status, corpo: await res.json() };
  }

  async function entregar(tipo: string, objeto: unknown, criado = falso.estado.agora, id = `evt_${RUN}_${++evtSeq}`) {
    const payload = JSON.stringify({ id, object: "event", type: tipo, api_version: "2026-06-24.dahlia", created: criado, livemode: false, data: { object: objeto } });
    const assinatura = stripeCliente.webhooks.generateTestHeaderString({ payload, secret: SEGREDO });
    const res = await postWebhook(new Request("http://test/api/webhooks/stripe", { method: "POST", headers: { "stripe-signature": assinatura }, body: payload }));
    return { status: res.status, id };
  }

  const linha = (userId: string) =>
    prisma.subscription.findUnique({
      where: { userId },
      select: { plan: true, status: true, externalId: true, expiresAt: true, canceledAt: true, stripePlanoVersao: true, updatedAt: true },
    });
  const operacoes = (userId: string) =>
    prisma.stripeOperacao.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { tipo: true, status: true, planId: true, erro: true, externalId: true, substituida: true } });
  const cobrancasDe = (sub: string) => falso.estado.cobrancas.filter((c) => c.sub === sub);
  const escritas = (metodo: string) => falso.estado.escritas.filter((e) => e.startsWith(metodo)).length;
  const meta = (userId: string, planId: string) => ({ userId, planId, subscriptionPlan: PLANS[planId].plan });

  /** Assinante como o Checkout deixa: assinatura paga na Stripe e vínculo pela primeira fatura. */
  async function assinante(sufixo: string, planId: string, role = "DIARISTA") {
    const userId = await usuario(sufixo, role);
    const sub = falso.criarAssinatura({ metadata: meta(userId, planId), plano: PLANS[planId] });
    const primeira = falso.retrato(sub).latest_invoice as string;
    assert.equal((await entregar("invoice.paid", falso.faturaObj(primeira))).status, 200);
    const l = await linha(userId);
    assert.equal(l.externalId, sub);
    assert.equal(l.plan, PLANS[planId].plan);
    return { userId, sub };
  }

  async function acessoEfetivo(userId: string) {
    const { checkFeatureAccess } = await import("../../src/lib/featureGate");
    return (await checkFeatureAccess(userId, "SOLICITACOES_MES")).plan;
  }

  before(async () => {
    if (PULAR) throw new Error(`SAFESCORE_DB_REQUIRED=1, mas ${PULAR}`);
    process.env.DATABASE_URL = URL_BANCO;
    process.env.STRIPE_WEBHOOK_SECRET = SEGREDO;
    process.env.STRIPE_SECRET_KEY ??= "sk_test_ficticio_sem_uso_de_rede";
    ({ prisma } = await import("../../src/lib/prisma"));
    const modStripe = await import("../../src/lib/stripe");
    stripeCliente = modStripe.stripe;
    PLANS = modStripe.PLANS;
    postCheckout = (await import("../../src/app/api/billing/checkout/route")).POST;
    postWebhook = (await import("../../src/app/api/webhooks/stripe/route")).POST;
    postOps = (await import("../../src/app/api/ops/stripe-operacoes/route")).POST;
    ({ makeAuthHeaders } = await import("./_helpers"));
    ({ limitesTransacaoStripe: limitesTransacao } = await import("../../src/lib/assinatura"));
    ({ varrerOperacoes: varrer } = await import("../../src/lib/trocaDePlano"));

    // Assinatura de outro usuário gravada antes de tudo: não pode mudar.
    testemunha = await usuario("testemunha");
    await prisma.subscription.create({
      data: { userId: testemunha, plan: "PREMIUM", status: "ACTIVE", provider: "STRIPE", externalId: `sub_${RUN}_testemunha`, expiresAt: new Date("2027-01-01T00:00:00Z") },
    });
    fotoTestemunha = await linha(testemunha);
  });

  beforeEach(() => {
    falso?.restaurar();
    falso = criarStripeFalso();
    falso.instalar(stripeCliente);
  });

  after(async () => {
    falso?.restaurar();
    if (!prisma) return;
    assert.deepEqual(await linha(testemunha), fotoTestemunha, "assinatura de outro usuário intacta");
    await prisma.stripeOperacao.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.subscription.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.stripeEventoAssinatura.deleteMany({ where: { externalId: { startsWith: "sub_falso" } } });
    await prisma.user.deleteMany({ where: { id: { in: usuarios } } });
  });

  // ── 1. Upgrade com sucesso ────────────────────────────────────────────────

  it("BÁSICO → PRO: altera a MESMA assinatura, cobra a diferença uma vez e só ela renova, já como Pro", async () => {
    const { userId, sub } = await assinante("up_ok", "basico_mensal");
    const antes = await linha(userId);

    const r = await pedir(userId, "pro_mensal");
    assert.equal(r.status, 200);
    assert.equal(r.corpo.troca.situacao, "aplicada");
    assert.match(r.corpo.url, /\/billing\/success$/);
    assert.equal(r.corpo.checkoutUrl, r.corpo.url);

    assert.equal(falso.estado.sessoes.size, 0, "nenhum Checkout novo");
    assert.equal(falso.estado.assinaturas.size, 1, "nenhuma assinatura nova");
    const cobradas = cobrancasDe(sub);
    assert.deepEqual(cobradas.map((c) => c.motivo), ["subscription_create", "subscription_update"]);
    assert.ok(cobradas[1].valor > 0 && cobradas[1].valor <= 3990 - 1990, "diferença proporcional, não o valor cheio");

    const depois = await linha(userId);
    assert.equal(depois.plan, "PREMIUM");
    assert.equal(depois.externalId, sub);
    assert.equal(depois.stripePlanoVersao, 1);
    assert.deepEqual(depois.expiresAt, antes.expiresAt, "mesmo período pago");
    assert.equal(await acessoEfetivo(userId), "PREMIUM");
    assert.deepEqual(await operacoes(userId), [{ tipo: "upgrade", status: "concluida", planId: "pro_mensal", erro: null, externalId: sub, substituida: null }]);

    // Eventos da Stripe chegam depois (e de novo): nada a escrever.
    const foto = await linha(userId);
    const fatura = falso.retrato(sub).latest_invoice as string;
    for (let i = 0; i < 2; i++) {
      assert.equal((await entregar("customer.subscription.updated", falso.retrato(sub))).status, 200);
      assert.equal((await entregar("invoice.paid", falso.faturaObj(fatura))).status, 200);
    }
    assert.deepEqual(await linha(userId), foto, "reentregas não escrevem");

    // Renovação seguinte: uma assinatura só, no valor do Pro.
    assert.deepEqual(falso.cobrandoNaRenovacao(), [sub]);
    const renovacao = falso.renovar(sub);
    assert.equal((await entregar("invoice.paid", falso.faturaObj(renovacao))).status, 200);
    assert.deepEqual(cobrancasDe(sub).map((c) => [c.motivo, c.valor]).slice(-1), [["subscription_cycle", 3990]]);
    const renovada = await linha(userId);
    assert.equal(renovada.plan, "PREMIUM");
    assert.deepEqual(renovada.expiresAt, new Date(falso.retrato(sub).items.data[0].current_period_end * 1000));
  });

  it("repetir o pedido depois de aplicado: sem mudança e sem nova cobrança", async () => {
    const { userId, sub } = await assinante("up_rep", "basico_mensal");
    assert.equal((await pedir(userId, "pro_mensal")).corpo.troca.situacao, "aplicada");
    const r = await pedir(userId, "pro_mensal");
    assert.equal(r.status, 200);
    assert.equal(r.corpo.troca.situacao, "sem_mudanca");
    assert.equal(cobrancasDe(sub).length, 2);
    assert.equal(escritas("subscriptions.update"), 1);
  });

  // ── 2. Falha, autenticação e abandono ─────────────────────────────────────

  for (const cartao of ["falha", "3ds"] as const) {
    it(`fatura da troca não paga (${cartao}): nada aplicado, plano e validade anteriores intactos; abandono expira`, async () => {
      const { userId, sub } = await assinante(`up_${cartao}`, "basico_mensal");
      falso.cartao(sub, cartao);
      const antes = await linha(userId);

      const r = await pedir(userId, "pro_mensal");
      assert.equal(r.status, 200);
      assert.equal(r.corpo.troca.situacao, "aguardando_pagamento");
      const fatura = falso.retrato(sub).latest_invoice as string;
      assert.equal(r.corpo.url, `https://invoice.stripe.test/${fatura}`, "o app abre a fatura para pagar");
      assert.ok(falso.retrato(sub).pending_update, "troca pendente na Stripe");
      assert.equal(cobrancasDe(sub).length, 1, "só a primeira fatura foi cobrada");

      // A Stripe avisa a falha da fatura da troca: o período pago NÃO é cortado.
      assert.equal((await entregar("invoice.payment_failed", falso.faturaObj(fatura))).status, 200);
      assert.equal((await entregar("customer.subscription.updated", falso.retrato(sub))).status, 200);
      assert.deepEqual(await linha(userId), antes, "BASIC, ACTIVE, mesma validade, nenhuma escrita");
      assert.equal(await acessoEfetivo(userId), "BASIC");

      // Pedido repetido: mesma fatura, nenhuma chamada de troca nova.
      const repetido = await pedir(userId, "pro_mensal");
      assert.equal(repetido.corpo.url, r.corpo.url);
      assert.equal(escritas("subscriptions.update"), 1);

      // Abandono: a Stripe descarta a troca em 23 h.
      falso.expirarPendencia(sub);
      assert.equal((await entregar("customer.subscription.pending_update_expired", falso.retrato(sub))).status, 200);
      assert.deepEqual(await linha(userId), antes);
      assert.equal((await operacoes(userId))[0].status, "descartada");

      // Renovação seguinte (cartão regularizado): BÁSICO, uma assinatura só.
      falso.cartao(sub, "ok");
      const renovacao = falso.renovar(sub);
      assert.equal((await entregar("invoice.paid", falso.faturaObj(renovacao))).status, 200);
      assert.deepEqual(cobrancasDe(sub).map((c) => [c.motivo, c.valor]), [["subscription_create", 1990], ["subscription_cycle", 1990]]);
      assert.equal((await linha(userId)).plan, "BASIC");
    });
  }

  it("troca recusada e paga depois na fatura hospedada: aplica uma vez, pelo evento da Stripe", async () => {
    const { userId, sub } = await assinante("up_paga_depois", "basico_mensal");
    falso.cartao(sub, "falha");
    assert.equal((await pedir(userId, "pro_mensal")).corpo.troca.situacao, "aguardando_pagamento");
    const fatura = falso.retrato(sub).latest_invoice as string;

    falso.pagarFatura(fatura);
    assert.equal((await entregar("invoice.paid", falso.faturaObj(fatura))).status, 200);
    assert.equal((await entregar("customer.subscription.pending_update_applied", falso.retrato(sub))).status, 200);
    assert.equal((await entregar("customer.subscription.updated", falso.retrato(sub))).status, 200);

    const l = await linha(userId);
    assert.equal(l.plan, "PREMIUM");
    assert.equal(l.status, "ACTIVE");
    assert.equal(l.stripePlanoVersao, 1);
    assert.equal((await operacoes(userId))[0].status, "concluida");
    assert.deepEqual(cobrancasDe(sub).map((c) => c.motivo), ["subscription_create", "subscription_update"]);
  });

  it("checkout abandonado de quem não assina: nada no banco; a operação é descartada quando a sessão expira", async () => {
    const userId = await usuario("ck_abandono");
    const r = await pedir(userId, "basico_mensal");
    assert.equal(r.status, 200);
    assert.equal(r.corpo.troca, undefined);
    const [sessao] = [...falso.estado.sessoes.values()];
    falso.estado.sessoes.get(sessao.id)!.status = "expired";
    assert.equal((await entregar("checkout.session.expired", falso.sessaoObj(sessao.id))).status, 200);
    assert.equal(await linha(userId), null);
    assert.equal((await operacoes(userId))[0].status, "descartada");
    assert.equal(falso.estado.cobrancas.length, 0);
  });

  // ── 3. Concorrência e repetição ───────────────────────────────────────────

  it("dois pedidos simultâneos SEM assinatura: uma sessão só; outro plano expira a anterior; só uma pode ser paga", async () => {
    const userId = await usuario("ck_simultaneo");
    const [a, b] = await Promise.all([pedir(userId, "basico_mensal"), pedir(userId, "basico_mensal")]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal(a.corpo.url, b.corpo.url, "mesma sessão");
    assert.equal(falso.estado.sessoes.size, 1);

    const [c, d] = await Promise.all([pedir(userId, "pro_mensal"), pedir(userId, "basico_mensal")]);
    assert.equal(c.status, 200);
    assert.equal(d.status, 200);
    const abertas = [...falso.estado.sessoes.values()].filter((x) => x.status === "open");
    assert.equal(abertas.length, 1, "no máximo UMA sessão aberta por pessoa");

    const fechadas = [...falso.estado.sessoes.values()].filter((x) => x.status !== "open");
    for (const f of fechadas) assert.throws(() => falso.completarCheckout(f.id), /não está aberta/);
    const sub = falso.completarCheckout(abertas[0].id);

    // Pago, mas o vínculo ainda não chegou: outro pedido espera — não abre outra sessão.
    const sessoesAntes = falso.estado.sessoes.size;
    const antesDoWebhook = await pedir(userId, "pro_mensal");
    assert.equal(antesDoWebhook.status, 409);
    assert.equal(antesDoWebhook.corpo.error.code, "ASSINATURA_EM_CONFIRMACAO");
    assert.equal(falso.estado.sessoes.size, sessoesAntes);

    assert.equal((await entregar("checkout.session.completed", falso.sessaoObj(abertas[0].id))).status, 200);
    assert.equal((await entregar("invoice.paid", falso.faturaObj(falso.retrato(sub).latest_invoice as string))).status, 200);
    assert.equal((await linha(userId)).externalId, sub);
    assert.equal(falso.estado.assinaturas.size, 1, "uma assinatura no fim");
  });

  it("checkout pago e webhook atrasado: TODOS os pedidos seguintes esperam, nenhuma sessão nova; com o vínculo, a troca segue na mesma assinatura", async () => {
    const userId = await usuario("ck_atrasado");
    assert.equal((await pedir(userId, "basico_mensal")).status, 200);
    const [sessao] = [...falso.estado.sessoes.values()];
    const sub = falso.completarCheckout(sessao.id);
    for (let i = 0; i < 2; i++) {
      const r = await pedir(userId, "pro_mensal");
      assert.equal(r.status, 409, `pedido ${i + 1}`);
      assert.equal(r.corpo.error.code, "ASSINATURA_EM_CONFIRMACAO");
    }
    assert.equal(falso.estado.sessoes.size, 1, "nenhuma sessão nova enquanto o vínculo não chega");

    assert.equal((await entregar("checkout.session.completed", falso.sessaoObj(sessao.id))).status, 200);
    const troca = await pedir(userId, "pro_mensal");
    assert.equal(troca.status, 200);
    assert.equal(troca.corpo.troca.situacao, "aplicada");
    assert.equal(falso.estado.assinaturas.size, 1);
    assert.equal((await linha(userId)).externalId, sub);
  });

  it("dois pedidos simultâneos de upgrade: uma troca e UMA cobrança", async () => {
    const { userId, sub } = await assinante("up_simultaneo", "basico_mensal");
    const respostas = await Promise.all([pedir(userId, "pro_mensal"), pedir(userId, "pro_mensal"), pedir(userId, "pro_mensal")]);
    assert.deepEqual(respostas.map((r) => r.status), [200, 200, 200]);
    assert.deepEqual(respostas.map((r) => r.corpo.troca.situacao).sort(), ["aplicada", "sem_mudanca", "sem_mudanca"]);
    assert.equal(cobrancasDe(sub).filter((c) => c.motivo === "subscription_update").length, 1);
    assert.equal(escritas("subscriptions.update"), 1);
    assert.equal((await linha(userId)).plan, "PREMIUM");
  });

  // ── 4. Falha parcial entre Stripe e banco ─────────────────────────────────

  it("timeout DEPOIS de a Stripe aceitar (resposta perdida): 503, operação pendente; o novo pedido retoma sem cobrar de novo", async () => {
    const { userId, sub } = await assinante("parcial_resposta", "basico_mensal");
    let derrubar = true;
    falso.estado.antesDeResponder = async (metodo) => {
      if (metodo === "subscriptions.update" && derrubar) {
        derrubar = false;
        throw Object.assign(new Error("Request timed out"), { type: "StripeConnectionError" });
      }
    };

    const r = await pedir(userId, "pro_mensal");
    assert.equal(r.status, 503);
    assert.equal(cobrancasDe(sub).filter((c) => c.motivo === "subscription_update").length, 1, "a Stripe cobrou");
    assert.equal((await linha(userId)).plan, "BASIC", "o banco ainda não sabe");
    const [op] = await operacoes(userId);
    assert.equal(op.status, "pendente");
    assert.match(op.erro ?? "", /StripeConnectionError/);

    const retry = await pedir(userId, "pro_mensal");
    assert.equal(retry.status, 200);
    assert.equal(retry.corpo.troca.situacao, "sem_mudanca");
    assert.equal(cobrancasDe(sub).filter((c) => c.motivo === "subscription_update").length, 1, "nenhuma cobrança nova");
    const l = await linha(userId);
    assert.equal(l.plan, "PREMIUM");
    assert.equal(l.stripePlanoVersao, 1);
    assert.equal((await operacoes(userId))[0].status, "concluida");
  });

  it("banco falha DEPOIS de a Stripe cobrar (lock preso): 503; a operação persiste e o evento da Stripe a conclui", async () => {
    const { userId, sub } = await assinante("parcial_banco", "basico_mensal");
    const original = { ...limitesTransacao };
    limitesTransacao.lockTimeoutMs = 300;
    const outra = new pg.Client({ connectionString: URL_BANCO });
    await outra.connect();
    try {
      // Outra conexão segura o lock da `sub_`: a gravação do plano não consegue terminar.
      await outra.query("BEGIN");
      await outra.query("SELECT pg_advisory_xact_lock(7702, hashtext($1))", [sub]);
      const r = await pedir(userId, "pro_mensal");
      assert.equal(r.status, 503);
      assert.equal(cobrancasDe(sub).filter((c) => c.motivo === "subscription_update").length, 1);
      assert.equal((await linha(userId)).plan, "BASIC");
      assert.equal((await operacoes(userId))[0].status, "pendente");
    } finally {
      await outra.query("ROLLBACK").catch(() => {});
      await outra.end();
      Object.assign(limitesTransacao, original);
    }

    // O retrato da assinatura chega: grava o plano e retoma a operação gravada.
    assert.equal((await entregar("customer.subscription.updated", falso.retrato(sub))).status, 200);
    const l = await linha(userId);
    assert.equal(l.plan, "PREMIUM");
    assert.equal((await operacoes(userId))[0].status, "concluida");
    assert.equal(cobrancasDe(sub).filter((c) => c.motivo === "subscription_update").length, 1);
    assert.equal(escritas("subscriptions.update"), 1, "a retomada releu a Stripe e não chamou de novo");
  });

  it("retomada pela rota de operações (admin), sem pedido do usuário nem evento", async () => {
    const { userId, sub } = await assinante("parcial_ops", "basico_mensal");
    falso.estado.antesDeResponder = async (metodo) => {
      if (metodo === "subscriptions.update") throw Object.assign(new Error("socket hang up"), { type: "StripeConnectionError" });
    };
    assert.equal((await pedir(userId, "pro_mensal")).status, 503);
    falso.estado.antesDeResponder = null;

    const admin = await usuario("admin_ops", "ADMIN");
    const negado = await postOps(new Request("http://test/api/ops/stripe-operacoes", { method: "POST", headers: makeAuthHeaders(userId, "DIARISTA") }));
    assert.equal(negado.status, 403);
    const res = await postOps(new Request("http://test/api/ops/stripe-operacoes", { method: "POST", headers: makeAuthHeaders(admin, "ADMIN") }));
    assert.equal(res.status, 200);
    assert.equal((await linha(userId)).plan, "PREMIUM");
    assert.equal((await operacoes(userId))[0].status, "concluida");
    assert.equal(cobrancasDe(sub).filter((c) => c.motivo === "subscription_update").length, 1);
  });

  // ── 5. Ordem dos eventos ──────────────────────────────────────────────────

  it("retrato antigo ou reentregue não desfaz a troca; downgrade no fim do período não é desfeito pelo upgrade atrasado", async () => {
    const { userId, sub } = await assinante("ordem", "basico_mensal");
    const retratoBasico = falso.retrato(sub);
    assert.equal((await pedir(userId, "pro_mensal")).corpo.troca.situacao, "aplicada");
    const retratoPro = falso.retrato(sub);
    const faturaTroca = retratoPro.latest_invoice as string;

    const foto = await linha(userId);
    assert.equal((await entregar("customer.subscription.updated", retratoBasico, falso.estado.agora + 5)).status, 200);
    assert.equal((await entregar("customer.subscription.updated", retratoPro)).status, 200);
    assert.deepEqual(await linha(userId), foto, "retrato antigo (versão 0) depois do novo: nada muda");

    // Downgrade agendado e período virado.
    assert.equal((await pedir(userId, "basico_mensal")).corpo.troca.situacao, "agendada");
    assert.equal((await linha(userId)).plan, "PREMIUM", "até o fim do período pago");
    const renovacao = falso.renovar(sub);
    assert.equal((await entregar("customer.subscription.updated", falso.retrato(sub))).status, 200);
    assert.equal((await entregar("invoice.paid", falso.faturaObj(renovacao))).status, 200);
    assert.equal((await linha(userId)).plan, "BASIC");

    // Atrasados: o retrato do upgrade (versão 1) e a fatura da troca.
    const depois = await linha(userId);
    assert.equal((await entregar("customer.subscription.updated", retratoPro)).status, 200);
    assert.equal((await entregar("invoice.paid", falso.faturaObj(faturaTroca))).status, 200);
    assert.deepEqual(await linha(userId), depois);
  });

  // ── 6. Downgrade ──────────────────────────────────────────────────────────

  it("downgrade PRO → BÁSICO: agendado sem cobrança nem crédito; a renovação seguinte cobra o plano menor", async () => {
    const { userId, sub } = await assinante("down", "pro_mensal");
    const antes = await linha(userId);
    const r = await pedir(userId, "basico_mensal");
    assert.equal(r.status, 200);
    assert.equal(r.corpo.troca.situacao, "agendada");
    assert.equal(new Date(r.corpo.troca.vigenteEm).getTime(), antes.expiresAt.getTime(), "vale no fim do período pago");
    assert.deepEqual(await linha(userId), antes, "nada muda antes do fim do período");
    assert.equal(cobrancasDe(sub).length, 1);

    // Repetido: nenhuma agenda nova.
    assert.equal((await pedir(userId, "basico_mensal")).corpo.troca.situacao, "agendada");
    assert.equal(escritas("subscriptionSchedules.create"), 1);
    assert.equal(escritas("subscriptionSchedules.update"), 1);

    const renovacao = falso.renovar(sub);
    // Só a fatura da renovação (sem o retrato): ela já carrega os metadados do plano menor.
    assert.equal((await entregar("invoice.paid", falso.faturaObj(renovacao))).status, 200);
    assert.deepEqual(cobrancasDe(sub).map((c) => [c.motivo, c.valor]), [["subscription_create", 3990], ["subscription_cycle", 1990]]);
    const l = await linha(userId);
    assert.equal(l.plan, "BASIC");
    assert.equal(l.status, "ACTIVE");
    assert.equal(await acessoEfetivo(userId), "BASIC");
    // O retrato chega depois: mesma versão, nada a escrever.
    assert.equal((await entregar("customer.subscription.updated", falso.retrato(sub))).status, 200);
    assert.deepEqual(await linha(userId), l);
  });

  it("downgrade agendado e depois o plano atual de novo: a agenda é desfeita e a renovação segue no Pro", async () => {
    const { userId, sub } = await assinante("down_volta", "pro_mensal");
    assert.equal((await pedir(userId, "basico_mensal")).corpo.troca.situacao, "agendada");
    assert.equal((await pedir(userId, "pro_mensal")).corpo.troca.situacao, "sem_mudanca");
    assert.equal(falso.retrato(sub).schedule, null);
    const renovacao = falso.renovar(sub);
    assert.equal((await entregar("invoice.paid", falso.faturaObj(renovacao))).status, 200);
    assert.deepEqual(cobrancasDe(sub).map((c) => c.valor), [3990, 3990]);
    assert.equal((await linha(userId)).plan, "PREMIUM");
  });

  it("mensal → anual: cobra o anual com crédito do mês e a validade vai ao fim do ANUAL (maior fim das linhas)", async () => {
    const { userId, sub } = await assinante("anual", "pro_mensal");
    const r = await pedir(userId, "pro_anual");
    assert.equal(r.corpo.troca.situacao, "aplicada");
    const fatura = falso.retrato(sub).latest_invoice as string;
    const linhas = falso.faturaObj(fatura).lines.data;
    assert.ok(linhas[0].amount < 0, "crédito do tempo não usado");
    assert.ok(cobrancasDe(sub)[1].valor < 35900, "anual menos o crédito");
    assert.equal((await entregar("invoice.paid", falso.faturaObj(fatura))).status, 200);
    const fimAnual = Math.max(...linhas.map((x) => x.period.end));
    assert.deepEqual((await linha(userId)).expiresAt, new Date(fimAnual * 1000));
    assert.ok(fimAnual - falso.estado.agora >= 364 * DIA);
  });

  // ── 7. Assinatura duplicada (corrida, legado) ─────────────────────────────

  it("duplicada: a antiga só é cancelada (fim do período) com a nova PAGA e do MESMO usuário", async () => {
    const { userId, sub: antiga } = await assinante("dup", "basico_mensal");
    // Segunda assinatura do mesmo usuário (outra aba, legado) com a 1ª fatura em aberto.
    const nova = falso.criarAssinatura({ metadata: meta(userId, "pro_mensal"), plano: PLANS.pro_mensal });
    const faturaNova = falso.retrato(nova).latest_invoice as string;
    falso.estado.faturas.get(faturaNova)!.status = "open";
    falso.estado.cobrancas = falso.estado.cobrancas.filter((c) => c.fatura !== faturaNova);

    const sessao = { id: `cs_${RUN}_dup`, object: "checkout.session", mode: "subscription", payment_status: "unpaid", client_reference_id: userId, subscription: nova, metadata: meta(userId, "pro_mensal") };
    assert.equal((await entregar("checkout.session.completed", sessao, falso.estado.agora + 10)).status, 200);
    assert.equal((await linha(userId)).externalId, nova, "o vínculo passou para a nova");
    assert.equal(falso.retrato(antiga).cancel_at_period_end, false, "nova sem pagamento: a antiga NÃO é cancelada");
    let [op] = await operacoes(userId);
    assert.deepEqual([op.tipo, op.status, op.erro, op.substituida], ["cancelar_substituida", "pendente", "nova_nao_paga", antiga]);

    // A nova é paga: o evento libera o cancelamento gravado.
    falso.pagarFatura(faturaNova);
    assert.equal((await entregar("invoice.paid", falso.faturaObj(faturaNova), falso.estado.agora + 20)).status, 200);
    assert.equal(falso.retrato(antiga).cancel_at_period_end, true);
    [op] = await operacoes(userId);
    assert.equal(op.status, "concluida");
    assert.deepEqual(falso.cobrandoNaRenovacao().sort(), [nova].sort(), "só a nova renova");
  });

  it("duplicada de OUTRO usuário (metadados não batem): nada é cancelado", async () => {
    const { userId, sub: antiga } = await assinante("dup_outro", "basico_mensal");
    const intrusa = await usuario("dup_intrusa");
    const nova = falso.criarAssinatura({ metadata: meta(intrusa, "pro_mensal"), plano: PLANS.pro_mensal });
    const sessao = { id: `cs_${RUN}_dup_outro`, object: "checkout.session", mode: "subscription", payment_status: "paid", client_reference_id: userId, subscription: nova, metadata: meta(userId, "pro_mensal") };
    assert.equal((await entregar("checkout.session.completed", sessao, falso.estado.agora + 10)).status, 200);
    assert.equal(falso.retrato(antiga).cancel_at_period_end, false);
    const [op] = await operacoes(userId);
    assert.deepEqual([op.status, op.erro], ["falhou", "nova_de_outro_usuario"]);
  });

  it("duplicada com a Stripe fora no cancelamento: 500 (a Stripe reenvia), operação pendente; a reentrega conclui", async () => {
    const { userId, sub: antiga } = await assinante("dup_falha", "basico_mensal");
    const nova = falso.criarAssinatura({ metadata: meta(userId, "pro_mensal"), plano: PLANS.pro_mensal });
    const sessao = { id: `cs_${RUN}_dup_falha`, object: "checkout.session", mode: "subscription", payment_status: "paid", client_reference_id: userId, subscription: nova, metadata: meta(userId, "pro_mensal") };
    let fora = true;
    falso.estado.antesDeResponder = async (metodo) => {
      if (metodo === "subscriptions.update" && fora) {
        fora = false;
        throw Object.assign(new Error("api indisponível"), { type: "StripeAPIError", statusCode: 503 });
      }
    };
    const primeira = await entregar("checkout.session.completed", sessao, falso.estado.agora + 10);
    assert.equal(primeira.status, 500);
    assert.equal((await linha(userId)).externalId, nova, "o vínculo ficou gravado");
    assert.equal((await operacoes(userId))[0].status, "pendente");

    assert.equal((await entregar("checkout.session.completed", sessao, falso.estado.agora + 10, primeira.id)).status, 200);
    assert.equal(falso.retrato(antiga).cancel_at_period_end, true);
    assert.equal((await operacoes(userId))[0].status, "concluida");
  });

  // ── 8. Varredura: retomada sem pedido do usuário e sem evento ─────────────
  //
  // É o que o servidor roda no boot e em intervalo (lib/varreduraDeOperacoes).
  // "Envelhecer" põe a operação no passado, como depois de uma queda; a
  // varredura só pega o que está parado há mais que os prazos de limitesTroca.

  async function envelhecer(userId: string, minutos: number) {
    await prisma.$executeRawUnsafe(
      `UPDATE "StripeOperacao" SET "updatedAt" = "updatedAt" - make_interval(mins => $2), "createdAt" = "createdAt" - make_interval(mins => $2) WHERE "userId" = $1`,
      userId,
      minutos,
    );
  }
  const varrerTudo = () => varrer({ limite: 500 });

  it("queda depois de a Stripe aplicar a troca: a varredura (boot) conclui — sem pedido, sem evento, sem cobrar de novo", async () => {
    const { userId, sub } = await assinante("varre_aplicada", "basico_mensal");
    let derrubar = true;
    falso.estado.antesDeResponder = async (metodo) => {
      if (metodo === "subscriptions.update" && derrubar) {
        derrubar = false;
        throw Object.assign(new Error("processo caiu"), { type: "StripeConnectionError" });
      }
    };
    assert.equal((await pedir(userId, "pro_mensal")).status, 503);
    falso.estado.antesDeResponder = null;
    assert.equal((await operacoes(userId))[0].status, "pendente");

    // Recém-gravada pode estar em andamento: a varredura não mexe.
    await varrerTudo();
    assert.equal((await operacoes(userId))[0].status, "pendente");
    assert.equal((await linha(userId)).plan, "BASIC");

    await envelhecer(userId, 2);
    await varrerTudo();
    const l = await linha(userId);
    assert.equal(l.plan, "PREMIUM");
    assert.equal(l.stripePlanoVersao, 1);
    assert.equal((await operacoes(userId))[0].status, "concluida");
    assert.equal(escritas("subscriptions.update"), 1, "releu a Stripe: nenhuma chamada de troca nova");
    assert.equal(cobrancasDe(sub).filter((c) => c.motivo === "subscription_update").length, 1);
  });

  it("pedido parado SEM efeito na Stripe e vencido: descartado — nem a varredura nem o próximo pedido cobram tarde", async () => {
    const { userId, sub } = await assinante("varre_vencida", "basico_mensal");
    // Caiu antes da chamada à Stripe: só a operação ficou gravada.
    let derrubar = true;
    falso.estado.recusarAntes = (metodo) => {
      if (metodo !== "subscriptions.update" || !derrubar) return false;
      derrubar = false;
      return true;
    };
    assert.equal((await pedir(userId, "pro_mensal")).status, 503);
    falso.estado.recusarAntes = null;
    assert.equal(escritas("subscriptions.update"), 0);

    // Uma hora depois o usuário pede de novo o plano que já tem: a operação velha não é executada.
    await envelhecer(userId, 60);
    const r = await pedir(userId, "basico_mensal");
    assert.equal(r.status, 200);
    assert.equal(r.corpo.troca.situacao, "sem_mudanca");
    assert.equal(escritas("subscriptions.update"), 0, "nenhuma troca executada tarde");
    assert.deepEqual(cobrancasDe(sub).map((c) => c.motivo), ["subscription_create"]);
    const [op] = await operacoes(userId);
    assert.deepEqual([op.status, op.erro], ["descartada", "pedido_vencido_sem_efeito"]);
    assert.equal((await linha(userId)).plan, "BASIC");
  });

  it("pedido vencido encontrado pela varredura: descartado, nenhuma chamada à Stripe", async () => {
    const { userId } = await assinante("varre_vencida2", "basico_mensal");
    falso.estado.recusarAntes = (metodo) => metodo === "subscriptions.update";
    assert.equal((await pedir(userId, "pro_mensal")).status, 503);
    falso.estado.recusarAntes = null;
    await envelhecer(userId, 30);
    await varrerTudo();
    const [op] = await operacoes(userId);
    assert.deepEqual([op.status, op.erro], ["descartada", "pedido_vencido_sem_efeito"]);
    assert.equal(escritas("subscriptions.update"), 0);
  });

  it("cancelamento da substituída com a Stripe fora e SEM reentrega: a varredura cancela depois", async () => {
    const { userId, sub: antiga } = await assinante("varre_dup", "basico_mensal");
    const nova = falso.criarAssinatura({ metadata: meta(userId, "pro_mensal"), plano: PLANS.pro_mensal });
    const sessao = { id: `cs_${RUN}_varre_dup`, object: "checkout.session", mode: "subscription", payment_status: "paid", client_reference_id: userId, subscription: nova, metadata: meta(userId, "pro_mensal") };
    falso.estado.recusarAntes = (metodo) => metodo === "subscriptions.update";
    assert.equal((await entregar("checkout.session.completed", sessao, falso.estado.agora + 10)).status, 500);
    falso.estado.recusarAntes = null;
    assert.equal(falso.retrato(antiga).cancel_at_period_end, false);
    assert.equal((await operacoes(userId))[0].status, "pendente");

    // Nenhuma reentrega: a varredura acha a operação gravada.
    await envelhecer(userId, 2);
    await varrerTudo();
    assert.equal(falso.retrato(antiga).cancel_at_period_end, true);
    assert.equal((await operacoes(userId))[0].status, "concluida");
  });

  it("nova encerrada sem pagamento: o cancelamento é descartado e a antiga segue", async () => {
    const { userId, sub: antiga } = await assinante("varre_dup_morta", "basico_mensal");
    const nova = falso.criarAssinatura({ metadata: meta(userId, "pro_mensal"), plano: PLANS.pro_mensal });
    falso.estado.faturas.get(falso.retrato(nova).latest_invoice as string)!.status = "open";
    const sessao = { id: `cs_${RUN}_varre_morta`, object: "checkout.session", mode: "subscription", payment_status: "unpaid", client_reference_id: userId, subscription: nova, metadata: meta(userId, "pro_mensal") };
    assert.equal((await entregar("checkout.session.completed", sessao, falso.estado.agora + 10)).status, 200);
    assert.equal((await operacoes(userId))[0].erro, "nova_nao_paga");
    falso.estado.assinaturas.get(nova)!.status = "incomplete_expired";
    await envelhecer(userId, 2);
    await varrerTudo();
    const [op] = await operacoes(userId);
    assert.deepEqual([op.status, op.erro], ["descartada", "nova_encerrada_sem_pagamento"]);
    assert.equal(falso.retrato(antiga).cancel_at_period_end, false);
  });

  it("troca paga depois na fatura e NENHUM evento entregue: a varredura grava o plano", async () => {
    const { userId, sub } = await assinante("varre_paga", "basico_mensal");
    falso.cartao(sub, "falha");
    assert.equal((await pedir(userId, "pro_mensal")).corpo.troca.situacao, "aguardando_pagamento");
    falso.pagarFatura(falso.retrato(sub).latest_invoice as string);
    await varrerTudo();
    assert.equal((await linha(userId)).plan, "BASIC", "aguardando recém-conferida: só depois do intervalo");
    await envelhecer(userId, 11);
    await varrerTudo();
    const l = await linha(userId);
    assert.equal(l.plan, "PREMIUM");
    assert.equal(l.stripePlanoVersao, 1);
    assert.equal((await operacoes(userId))[0].status, "concluida");
  });

  it("troca não paga que expirou e checkout expirado, sem eventos: a varredura descarta; nada muda no plano", async () => {
    const { userId, sub } = await assinante("varre_exp", "basico_mensal");
    falso.cartao(sub, "3ds");
    assert.equal((await pedir(userId, "pro_mensal")).corpo.troca.situacao, "aguardando_pagamento");
    falso.expirarPendencia(sub);
    const semAssinatura = await usuario("varre_ck_exp");
    assert.equal((await pedir(semAssinatura, "basico_mensal")).status, 200);
    for (const ses of falso.estado.sessoes.values()) ses.status = "expired";
    await envelhecer(userId, 11);
    await envelhecer(semAssinatura, 11);
    await varrerTudo();
    assert.deepEqual((await operacoes(userId)).map((o: any) => [o.status, o.erro]), [["descartada", "troca_nao_paga_expirou"]]);
    assert.deepEqual((await operacoes(semAssinatura)).map((o: any) => [o.status, o.erro]), [["descartada", "checkout_expirou"]]);
    assert.equal((await linha(userId)).plan, "BASIC");
  });

  // ── 9. Recusas que não cobram ─────────────────────────────────────────────

  it("assinatura com pagamento pendente (past_due): nem troca nem checkout novo", async () => {
    const { userId, sub } = await assinante("past_due", "basico_mensal");
    falso.estado.assinaturas.get(sub)!.status = "past_due";
    const r = await pedir(userId, "pro_mensal");
    assert.equal(r.status, 409);
    assert.equal(r.corpo.error.code, "ASSINATURA_COM_PENDENCIA");
    assert.equal(falso.estado.sessoes.size, 0);
    assert.equal(escritas("subscriptions.update"), 0);
  });
});
