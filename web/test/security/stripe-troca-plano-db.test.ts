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
  let getOps: (req: Request) => Promise<Response>;
  let makeAuthHeaders: (userId: string, role: any) => Record<string, string>;
  let limitesTransacao: { lockTimeoutMs: number; statementTimeoutMs: number };
  let varrer: (opcoes?: { imediato?: boolean; limite?: number }) => Promise<{ examinadas: number; falhas: number; emAndamento?: true }>;
  let getCron: (req: Request) => Promise<Response>;
  let limitesTroca: { ociosoVarreduraMs: number };
  let limitesPresenca: { intervaloMs: number; ultimaMs: number };
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
    await provasDeOrigem(id);
    return id;
  }

  /**
   * Assinaturas criadas direto na Stripe simulada (sem passar pela rota) levam
   * nos metadados a operação `checkout` que a rota teria gravado: é a prova de
   * origem (lib/origemDoCheckout). Uma por plano, já concluída — fora da
   * varredura e das asserções de operações.
   */
  async function provasDeOrigem(userId: string) {
    await prisma.stripeOperacao.createMany({
      data: Object.keys(PLANS).map((planId) => ({ userId, tipo: "checkout", status: "concluida", planId, chave: `prova_${userId}_${planId}` })),
    });
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
    prisma.stripeOperacao.findMany({ where: { userId, NOT: { chave: { startsWith: "prova_" } } }, orderBy: { createdAt: "asc" }, select: { tipo: true, status: true, planId: true, erro: true, externalId: true, substituida: true } });
  const cobrancasDe = (sub: string) => falso.estado.cobrancas.filter((c) => c.sub === sub);
  const escritas = (metodo: string) => falso.estado.escritas.filter((e) => e.startsWith(metodo)).length;
  const meta = (userId: string, planId: string) => ({ userId, planId, subscriptionPlan: PLANS[planId].plan, operacao: `prova_${userId}_${planId}` });

  /** Assinante como o Checkout deixa: assinatura paga na Stripe e vínculo pela primeira fatura. */
  async function assinante(sufixo: string, planId: string, role = "DIARISTA") {
    const userId = await usuario(sufixo, role);
    const sub = falso.criarAssinatura({ metadata: meta(userId, planId), plano: PLANS[planId] });
    const primeira = falso.retrato(sub).latest_invoice as string;
    // Como a rota deixa depois do checkout: a operação dele ligada a esta `sub_`
    // (é o que o `invoice.paid` antes do completed confere).
    const chave = `prova_${sub}`;
    await prisma.stripeOperacao.create({ data: { userId, tipo: "checkout", status: "concluida", planId, externalId: sub, chave } });
    falso.estado.assinaturas.get(sub)!.metadata.operacao = chave;
    falso.estado.faturas.get(primeira)!.metadata.operacao = chave;
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
    ({ POST: postOps, GET: getOps } = await import("../../src/app/api/ops/stripe-operacoes/route"));
    getCron = (await import("../../src/app/api/cron/reconciliar-stripe/route")).GET;
    ({ makeAuthHeaders } = await import("./_helpers"));
    ({ limitesTransacaoStripe: limitesTransacao } = await import("../../src/lib/assinatura"));
    ({ varrerOperacoes: varrer, limitesTroca } = await import("../../src/lib/trocaDePlano"));
    ({ limitesPresenca } = await import("../../src/lib/origemDoCheckout"));

    // Assinatura de outro usuário gravada antes de tudo: não pode mudar.
    testemunha = await usuario("testemunha");
    await prisma.subscription.create({
      data: { userId: testemunha, plan: "PREMIUM", status: "ACTIVE", provider: "STRIPE", externalId: `sub_${RUN}_testemunha`, expiresAt: new Date("2027-01-01T00:00:00Z") },
    });
    fotoTestemunha = await linha(testemunha);
  });

  beforeEach(() => {
    falso?.restaurar();
    // Relógio da Stripe simulada a partir do relógio real (como em
    // google-play-db e stripe-loja-canais-db). Com o início fixo padrão
    // (21/09/2026), o período mensal terminava em 21/10/2026 e, depois dessa
    // data, `assinaturaEfetiva` (que compara com o relógio real) passou a ver
    // as assinaturas como vencidas: os testes de acesso efetivo falhavam
    // sem nenhuma mudança de código.
    falso = criarStripeFalso(Math.floor(Date.now() / 1000) - 3600);
    falso.instalar(stripeCliente);
  });

  after(async () => {
    falso?.restaurar();
    if (!prisma) return;
    assert.deepEqual(await linha(testemunha), fotoTestemunha, "assinatura de outro usuário intacta");
    await prisma.stripeOperacao.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.stripeRevisao.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.stripeJanelaLegado.deleteMany({ where: { origem: `teste_${RUN}` } });
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
    // Token que DIZ admin, de quem no banco não é: o papel vale pelo banco.
    const forjado = await postOps(new Request("http://test/api/ops/stripe-operacoes", { method: "POST", headers: makeAuthHeaders(userId, "ADMIN") }));
    assert.equal(forjado.status, 403);
    assert.equal((await operacoes(userId))[0].status, "pendente", "nada varrido pelo token forjado");
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

  // ── 9. Cron autenticado da plataforma (Vercel Cron) ───────────────────────
  //
  // A mesma varredura, com hora marcada. Segredo FICTÍCIO, só de teste.

  const SEGREDO_CRON = "segredo_ficticio_de_teste_do_cron_0123456789";
  const cron = (authorization?: string) =>
    getCron(new Request("http://test/api/cron/reconciliar-stripe", { headers: authorization === undefined ? {} : { authorization } }));
  async function comSegredoDoCron<T>(valor: string | undefined, fn: () => Promise<T>): Promise<T> {
    const anterior = process.env.CRON_SECRET;
    if (valor === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = valor;
    try {
      return await fn();
    } finally {
      if (anterior === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = anterior;
    }
  }
  /** Troca aplicada na Stripe com a resposta perdida: operação pendente, banco sem saber, já envelhecida. */
  async function trocaParada(sufixo: string) {
    const { userId, sub } = await assinante(sufixo, "basico_mensal");
    let derrubar = true;
    falso.estado.antesDeResponder = async (metodo) => {
      if (metodo === "subscriptions.update" && derrubar) {
        derrubar = false;
        throw Object.assign(new Error("resposta perdida"), { type: "StripeConnectionError" });
      }
    };
    assert.equal((await pedir(userId, "pro_mensal")).status, 503);
    falso.estado.antesDeResponder = null;
    await envelhecer(userId, 2);
    return { userId, sub };
  }
  const trocasCobradas = (sub: string) => cobrancasDe(sub).filter((c) => c.motivo === "subscription_update").length;

  it("cron sem CRON_SECRET (ou curto): 503 e NADA é varrido — falha fechada", async () => {
    const { userId } = await trocaParada("cron_sem_segredo");
    for (const valor of [undefined, "curto_demais"]) {
      const res = await comSegredoDoCron(valor, () => cron(`Bearer ${valor ?? "qualquer"}`));
      assert.equal(res.status, 503);
    }
    assert.equal((await operacoes(userId))[0].status, "pendente");
    assert.equal((await linha(userId)).plan, "BASIC");
  });

  it("cron com autenticação errada: 401 e nada varrido", async () => {
    const { userId } = await trocaParada("cron_negado");
    await comSegredoDoCron(SEGREDO_CRON, async () => {
      for (const header of [undefined, "", "Bearer errado", `bearer ${SEGREDO_CRON}`, SEGREDO_CRON, `Bearer ${SEGREDO_CRON}x`, `Basic ${SEGREDO_CRON}`]) {
        assert.equal((await cron(header)).status, 401, `cabeçalho ${JSON.stringify(header)}`);
      }
    });
    assert.equal((await operacoes(userId))[0].status, "pendente");
  });

  it("cron autenticado: conclui a troca parada sem cobrar de novo; repetido não muda nada", async () => {
    const { userId, sub } = await trocaParada("cron_ok");
    await comSegredoDoCron(SEGREDO_CRON, async () => {
      const res = await cron(`Bearer ${SEGREDO_CRON}`);
      assert.equal(res.status, 200);
      const corpo = await res.json();
      assert.equal(corpo.falhas, 0);
      assert.ok(corpo.examinadas >= 1);
      const depois = await linha(userId);
      assert.equal(depois.plan, "PREMIUM");
      const [op] = await prisma.stripeOperacao.findMany({ where: { userId, NOT: { chave: { startsWith: "prova_" } } }, select: { status: true, tentativas: true } });
      assert.deepEqual(op, { status: "concluida", tentativas: 1 });

      assert.equal((await cron(`Bearer ${SEGREDO_CRON}`)).status, 200, "repetido");
      assert.deepEqual(await linha(userId), depois, "repetido: nenhuma escrita");
      assert.deepEqual(await prisma.stripeOperacao.findMany({ where: { userId, NOT: { chave: { startsWith: "prova_" } } }, select: { status: true, tentativas: true } }), [op]);
    });
    assert.equal(trocasCobradas(sub), 1, "uma cobrança de troca, a original");
    assert.equal(escritas("subscriptions.update"), 1, "releu a Stripe; nenhuma troca nova");
  });

  it("cron entregue em dobro, ao mesmo tempo: uma rodada executa, as outras saem com emAndamento; uma tentativa só", async () => {
    const { userId, sub } = await trocaParada("cron_concorrente");
    falso.estado.atrasoLeituraMs = 150;
    try {
      const corpos = await comSegredoDoCron(SEGREDO_CRON, () =>
        Promise.all([1, 2, 3].map(async () => {
          const res = await cron(`Bearer ${SEGREDO_CRON}`);
          assert.equal(res.status, 200);
          return res.json();
        })),
      );
      assert.equal(corpos.filter((c: any) => c.emAndamento).length, 2, JSON.stringify(corpos));
      assert.equal(corpos.filter((c: any) => !c.emAndamento && c.examinadas >= 1 && c.falhas === 0).length, 1);
    } finally {
      falso.estado.atrasoLeituraMs = 0;
    }
    const [op] = await prisma.stripeOperacao.findMany({ where: { userId, NOT: { chave: { startsWith: "prova_" } } }, select: { status: true, tentativas: true } });
    assert.deepEqual(op, { status: "concluida", tentativas: 1 });
    assert.equal((await linha(userId)).plan, "PREMIUM");
    assert.equal(trocasCobradas(sub), 1);
  });

  it("falha parcial na rodada do cron (Stripe fora): 500, operação segue gravada; a rodada seguinte conclui sem cobrança", async () => {
    const { userId, sub: antiga } = await assinante("cron_falha", "basico_mensal");
    const nova = falso.criarAssinatura({ metadata: meta(userId, "pro_mensal"), plano: PLANS.pro_mensal });
    const sessao = { id: `cs_${RUN}_cron_falha`, object: "checkout.session", mode: "subscription", payment_status: "paid", client_reference_id: userId, subscription: nova, metadata: meta(userId, "pro_mensal") };
    falso.estado.recusarAntes = (metodo) => metodo === "subscriptions.update";
    assert.equal((await entregar("checkout.session.completed", sessao, falso.estado.agora + 10)).status, 500);
    await envelhecer(userId, 2);
    const cobradasAntes = falso.estado.cobrancas.length;
    await comSegredoDoCron(SEGREDO_CRON, async () => {
      const comFalha = await cron(`Bearer ${SEGREDO_CRON}`);
      assert.equal(comFalha.status, 500);
      assert.ok((await comFalha.json()).falhas >= 1);
      const [op] = await operacoes(userId);
      assert.equal(op.status, "pendente");
      assert.match(op.erro ?? "", /StripeAPIError/);
      assert.equal(falso.retrato(antiga).cancel_at_period_end, false);

      falso.estado.recusarAntes = null;
      await envelhecer(userId, 2);
      assert.equal((await cron(`Bearer ${SEGREDO_CRON}`)).status, 200);
    });
    assert.equal(falso.retrato(antiga).cancel_at_period_end, true);
    assert.equal((await operacoes(userId))[0].status, "concluida");
    assert.equal(falso.estado.cobrancas.length, cobradasAntes, "nenhuma cobrança na reconciliação");
  });

  it("trava da varredura presa (instância congelada no meio da rodada): o Postgres a solta e a rodada seguinte roda", async () => {
    const { userId } = await trocaParada("trava_congelada");
    const original = limitesTroca.ociosoVarreduraMs;
    limitesTroca.ociosoVarreduraMs = 300;
    falso.estado.atrasoLeituraMs = 1_200; // a conexão da trava fica ociosa mais que o limite
    try {
      await assert.rejects(varrerTudo(), "o Postgres encerrou a sessão que segurava a trava");
    } finally {
      limitesTroca.ociosoVarreduraMs = original;
      falso.estado.atrasoLeituraMs = 0;
    }
    const seguinte = await varrerTudo();
    assert.equal(seguinte.emAndamento, undefined, "a trava global foi solta");
    assert.equal((await operacoes(userId))[0].status, "concluida");
    assert.equal((await linha(userId)).plan, "PREMIUM");
  });

  // ── 10. Recusas que não cobram ────────────────────────────────────────────

  it("assinatura com pagamento pendente (past_due): nem troca nem checkout novo", async () => {
    const { userId, sub } = await assinante("past_due", "basico_mensal");
    falso.estado.assinaturas.get(sub)!.status = "past_due";
    const r = await pedir(userId, "pro_mensal");
    assert.equal(r.status, 409);
    assert.equal(r.corpo.error.code, "ASSINATURA_COM_PENDENCIA");
    assert.equal(falso.estado.sessoes.size, 0);
    assert.equal(escritas("subscriptions.update"), 0);
  });

  // ── 11. Renovação da assinatura substituída (P1) e caso de revisão (P3) ───
  //
  // A Stripe renova em dois tempos: na virada nasce o RASCUNHO (`invoice.created`)
  // e cerca de 1 h depois ela finaliza e cobra (`finalizarRenovacao`). O relógio
  // da Stripe simulada parte do relógio real: "pago depois da substituição"
  // compara com a hora em que o vínculo trocou.

  const agoraReal = () => Math.floor(Date.now() / 1000);
  const fatura = (fid: string) => falso.estado.faturas.get(fid)!;
  const revisoesDe = (userId: string) =>
    prisma.stripeRevisao.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { tipo: true, status: true, userId: true, assinatura: true, substituida: true, faturaId: true, valor: true, moeda: true },
    });

  /** Duplicada já vinculada, com o cancelamento da antiga PENDENTE (Stripe fora na hora do completed). */
  async function substituidaPendente(sufixo: string) {
    falso.estado.agora = agoraReal();
    const { userId, sub: antiga } = await assinante(sufixo, "basico_mensal");
    const nova = falso.criarAssinatura({ metadata: meta(userId, "pro_mensal"), plano: PLANS.pro_mensal });
    const sessao = { id: `cs_${RUN}_${sufixo}`, object: "checkout.session", mode: "subscription", payment_status: "paid", client_reference_id: userId, subscription: nova, metadata: meta(userId, "pro_mensal") };
    falso.estado.recusarAntes = (m) => m === "subscriptions.update";
    assert.equal((await entregar("checkout.session.completed", sessao, falso.estado.agora + 10)).status, 500);
    falso.estado.recusarAntes = null;
    assert.equal((await linha(userId)).externalId, nova);
    assert.deepEqual((await operacoes(userId)).map((o: any) => [o.tipo, o.status]), [["cancelar_substituida", "pendente"]]);
    assert.equal(falso.retrato(antiga).cancel_at_period_end, false, "a antiga segue renovando");
    return { userId, antiga, nova };
  }

  it("renovação da substituída — RASCUNHO: o invoice.created grava e age antes do 2xx; cancela já e ANULA o rascunho; nada é cobrado", async () => {
    const { userId, antiga, nova } = await substituidaPendente("p1_rasc");
    const rascunho = falso.virada(antiga);
    assert.deepEqual([fatura(rascunho).status, fatura(rascunho).auto_advance], ["draft", true]);

    const r = await entregar("invoice.created", falso.faturaObj(rascunho));
    assert.equal(r.status, 200);
    assert.equal(falso.retrato(antiga).status, "canceled");
    assert.deepEqual([fatura(rascunho).status, fatura(rascunho).auto_advance, fatura(rascunho).tentativas], ["void", false, 0]);
    // Uma hora depois a Stripe finalizaria e cobraria: a fatura anulada não é cobrada.
    falso.finalizarRenovacao(rascunho);
    assert.deepEqual(cobrancasDe(antiga).map((c) => c.motivo), ["subscription_create"], "nenhuma renovação cobrada");
    assert.deepEqual([falso.retrato(nova).status, falso.retrato(nova).cancel_at_period_end], ["active", false], "a atual intacta");
    assert.equal((await linha(userId)).externalId, nova);
    const ops = await operacoes(userId);
    assert.equal(ops.length, 2, "a de origem e a desta fatura");
    assert.ok(ops.every((o: any) => o.status === "concluida"));
    assert.deepEqual(await revisoesDe(userId), []);
    for (const m of ["subscriptions.cancel", "invoices.finalizeInvoice", "invoices.voidInvoice"]) assert.equal(escritas(m), 1, m);

    // Reentregas: nenhuma escrita nova, nenhuma operação nova.
    const antes = falso.estado.escritas.length;
    for (let i = 0; i < 2; i++) assert.equal((await entregar("invoice.created", falso.faturaObj(rascunho), falso.estado.agora, r.id)).status, 200);
    assert.equal(falso.estado.escritas.length, antes);
    assert.equal((await operacoes(userId)).length, 2);
  });

  it("renovação da substituída — Stripe fora no invoice.created: 2xx DEPOIS de gravar; o cancelamento segue pendente e a retomada age antes da cobrança", async () => {
    const { userId, antiga } = await substituidaPendente("p1_fora");
    const rascunho = falso.virada(antiga);
    falso.estado.recusarAntes = (m) => m === "subscriptions.cancel";
    const r = await entregar("invoice.created", falso.faturaObj(rascunho));
    falso.estado.recusarAntes = null;
    assert.equal(r.status, 200, "2xx: a Stripe não segura a finalização das faturas");
    const gravada = await prisma.stripeOperacao.findMany({ where: { userId, referencia: rascunho }, select: { tipo: true, status: true, chave: true, erro: true } });
    assert.deepEqual(gravada.map((o: any) => [o.tipo, o.status, o.chave]), [["cancelar_substituida", "pendente", `dular-renovacao-${rascunho}`]]);
    assert.match(gravada[0].erro ?? "", /api_indisponivel/);
    assert.deepEqual([fatura(rascunho).status, falso.retrato(antiga).status], ["draft", "active"]);

    // Sem pedido do usuário: o retrato da assinatura (evento da Stripe) acorda a retomada.
    assert.equal((await entregar("customer.subscription.updated", falso.retrato(antiga))).status, 200);
    assert.equal(falso.retrato(antiga).status, "canceled");
    assert.equal(fatura(rascunho).status, "void");
    falso.finalizarRenovacao(rascunho);
    assert.deepEqual(cobrancasDe(antiga).map((c) => c.motivo), ["subscription_create"]);
    assert.ok((await operacoes(userId)).every((o: any) => o.status === "concluida"));
  });

  it("renovação da substituída — erro PERMANENTE da Stripe no meio (400): o cancelamento NÃO desiste; segue pendente e a reentrega conclui", async () => {
    const { userId, antiga } = await substituidaPendente("p1_400");
    const rascunho = falso.virada(antiga);
    falso.estado.recusarAntes = (m) =>
      m === "invoices.finalizeInvoice" && Object.assign(new Error("invoice is locked"), { type: "StripeInvalidRequestError", statusCode: 400, code: "invoice_locked" });
    const r = await entregar("invoice.created", falso.faturaObj(rascunho));
    falso.estado.recusarAntes = null;
    assert.equal(r.status, 200);
    const ops = await operacoes(userId);
    assert.deepEqual(ops.map((o: any) => o.status), ["pendente", "pendente"], "nenhuma operação desiste");
    assert.ok(ops.every((o: any) => /invoice_locked/.test(o.erro ?? "")));
    assert.equal(fatura(rascunho).status, "draft");
    assert.equal(fatura(rascunho).auto_advance, false, "a assinatura cancelada já tirou o rascunho da cobrança automática");

    assert.equal((await entregar("invoice.created", falso.faturaObj(rascunho), falso.estado.agora, r.id)).status, 200);
    assert.equal(fatura(rascunho).status, "void");
    assert.ok((await operacoes(userId)).every((o: any) => o.status === "concluida"));
    falso.finalizarRenovacao(rascunho);
    assert.deepEqual(cobrancasDe(antiga).map((c) => c.motivo), ["subscription_create"]);
  });

  it("renovação da substituída — ABERTA não paga (cartão recusado): cancela já e ANULA; a nova tentativa não cobra", async () => {
    const { userId, antiga } = await substituidaPendente("p1_aberta");
    const rascunho = falso.virada(antiga);
    // Nenhum gatilho agiu antes da finalização; o cartão recusa e a fatura fica aberta.
    falso.cartao(antiga, "falha");
    falso.finalizarRenovacao(rascunho);
    assert.deepEqual([fatura(rascunho).status, falso.retrato(antiga).status], ["open", "past_due"]);

    assert.equal((await entregar("customer.subscription.updated", falso.retrato(antiga))).status, 200);
    assert.deepEqual([fatura(rascunho).status, fatura(rascunho).auto_advance], ["void", false]);
    assert.equal(falso.retrato(antiga).status, "canceled");
    assert.equal(escritas("invoices.finalizeInvoice"), 0, "aberta: só anulada");
    // O cartão volta a passar e a Stripe tentaria de novo: anulada não é cobrada.
    falso.cartao(antiga, "ok");
    falso.finalizarRenovacao(rascunho);
    assert.deepEqual(cobrancasDe(antiga).map((c) => c.motivo), ["subscription_create"]);
    assert.deepEqual(await revisoesDe(userId), []);
  });

  it("renovação da substituída JÁ PAGA: caso de revisão (usuário, assinaturas, fatura, valor), sem estorno; reentregas não duplicam; a listagem mostra", async () => {
    const { userId, antiga, nova } = await substituidaPendente("p3_paga");
    const renovacao = falso.virada(antiga);
    falso.finalizarRenovacao(renovacao); // nenhum gatilho agiu a tempo: cobrada
    assert.equal(fatura(renovacao).status, "paid");

    const entregas = await Promise.all([0, 1, 2].map(() => entregar("invoice.paid", falso.faturaObj(renovacao), falso.estado.agora, `evt_${RUN}_p3_paga`)));
    assert.deepEqual(entregas.map((e) => e.status), [200, 200, 200]);
    assert.equal((await entregar("invoice.paid", falso.faturaObj(renovacao), falso.estado.agora, `evt_${RUN}_p3_paga`)).status, 200);

    assert.deepEqual(await revisoesDe(userId), [
      { tipo: "renovacao_paga_da_substituida", status: "aberta", userId, assinatura: nova, substituida: antiga, faturaId: renovacao, valor: 1990, moeda: "brl" },
    ]);
    assert.deepEqual([falso.retrato(antiga).status, falso.retrato(antiga).cancel_at_period_end], ["active", true], "não renova de novo; o período pago segue");
    assert.equal(escritas("subscriptions.cancel"), 0);
    assert.equal(escritas("invoices.voidInvoice"), 0);
    assert.deepEqual(cobrancasDe(antiga).map((c) => [c.motivo, c.valor]), [["subscription_create", 1990], ["subscription_cycle", 1990]], "nada estornado");
    const ops = await operacoes(userId);
    assert.ok(ops.every((o: any) => o.status === "concluida"));
    assert.ok(ops.some((o: any) => o.erro === "renovacao_paga_em_revisao"));

    const admin = await usuario("p3_admin", "ADMIN");
    const res = await getOps(new Request("http://test/api/ops/stripe-operacoes", { headers: makeAuthHeaders(admin, "ADMIN") }));
    assert.equal(res.status, 200);
    const corpo = await res.json();
    assert.equal(corpo.revisoes.filter((c: any) => c.faturaId === renovacao).length, 1);
    const negado = await getOps(new Request("http://test/api/ops/stripe-operacoes", { headers: makeAuthHeaders(userId, "DIARISTA") }));
    assert.equal(negado.status, 403);
  });

  it("renovação paga ANTES da substituição é legítima: nenhum caso de revisão; a antiga só não renova de novo", async () => {
    falso.estado.agora = agoraReal() - 40 * DIA;
    const { userId, sub: antiga } = await assinante("p3_antes", "basico_mensal");
    const renovada = falso.renovar(antiga); // paga há ~10 dias, antes de existir a duplicada
    assert.equal(fatura(renovada).status, "paid");
    falso.estado.agora = agoraReal();
    const nova = falso.criarAssinatura({ metadata: meta(userId, "pro_mensal"), plano: PLANS.pro_mensal });
    const sessao = { id: `cs_${RUN}_p3_antes`, object: "checkout.session", mode: "subscription", payment_status: "paid", client_reference_id: userId, subscription: nova, metadata: meta(userId, "pro_mensal") };
    assert.equal((await entregar("checkout.session.completed", sessao)).status, 200);
    assert.deepEqual([falso.retrato(antiga).status, falso.retrato(antiga).cancel_at_period_end], ["active", true]);
    assert.equal(escritas("subscriptions.cancel"), 0);
    assert.deepEqual(await revisoesDe(userId), []);
  });

  for (const caso of ["de_outro_usuario", "sem_dono", "vinculo_atual"] as const) {
    it(`renovação: NUNCA cancela assinatura ${caso.replace(/_/g, " ")}; a renovação dela segue normal`, async () => {
      falso.estado.agora = agoraReal();
      const { userId, sub: atual } = await assinante(`p1_${caso}`, "pro_mensal");
      let nova = atual;
      let alvo: string;
      if (caso === "vinculo_atual") {
        // O vínculo voltou para `atual`; a operação antiga ainda aponta para ela como substituída.
        nova = falso.criarAssinatura({ metadata: meta(userId, "basico_mensal"), plano: PLANS.basico_mensal });
        alvo = atual;
      } else {
        const dono = caso === "de_outro_usuario" ? await usuario(`p1_${caso}_dono`) : null;
        alvo = falso.criarAssinatura({ metadata: dono ? meta(dono, "basico_mensal") : { planId: "basico_mensal" }, plano: PLANS.basico_mensal });
      }
      await prisma.stripeOperacao.create({
        data: { userId, tipo: "cancelar_substituida", status: "concluida", externalId: nova, substituida: alvo, chave: `t_${RUN}_${caso}` },
      });
      const antes = falso.estado.escritas.length;
      const rascunho = falso.virada(alvo);
      assert.equal((await entregar("invoice.created", falso.faturaObj(rascunho))).status, 200);
      assert.equal(falso.estado.escritas.length, antes, "nenhuma escrita na Stripe");
      assert.deepEqual([falso.retrato(alvo).status, falso.retrato(alvo).cancel_at_period_end], ["active", false]);
      falso.finalizarRenovacao(rascunho);
      assert.equal(fatura(rascunho).status, "paid", "a renovação dela segue sendo cobrada");
      const [op] = await prisma.stripeOperacao.findMany({ where: { referencia: rascunho }, select: { status: true, erro: true } });
      const esperado = { de_outro_usuario: ["falhou", "antiga_de_outro_usuario"], sem_dono: ["falhou", "antiga_sem_dono_provado"], vinculo_atual: ["descartada", "antiga_e_o_vinculo_atual"] }[caso];
      assert.deepEqual([op.status, op.erro], esperado);
    });
  }

  it("renovação: invoice.created em dobro e retrato da assinatura AO MESMO TEMPO — um cancelamento, uma anulação, uma operação por fatura", async () => {
    const { userId, antiga } = await substituidaPendente("p1_conc");
    const rascunho = falso.virada(antiga);
    falso.estado.atrasoLeituraMs = 30;
    try {
      const evt = `evt_${RUN}_p1_conc_criada`;
      const r = await Promise.all([
        entregar("invoice.created", falso.faturaObj(rascunho), falso.estado.agora, evt),
        entregar("invoice.created", falso.faturaObj(rascunho), falso.estado.agora, evt),
        entregar("customer.subscription.updated", falso.retrato(antiga)),
      ]);
      assert.deepEqual(r.map((x) => x.status), [200, 200, 200]);
    } finally {
      falso.estado.atrasoLeituraMs = 0;
    }
    for (const m of ["subscriptions.cancel", "invoices.finalizeInvoice", "invoices.voidInvoice"]) assert.equal(escritas(m), 1, m);
    assert.equal(fatura(rascunho).status, "void");
    assert.equal(await prisma.stripeOperacao.count({ where: { referencia: rascunho } }), 1);
    assert.ok((await operacoes(userId)).every((o: any) => o.status === "concluida"));
    falso.finalizarRenovacao(rascunho);
    assert.deepEqual(cobrancasDe(antiga).map((c) => c.motivo), ["subscription_create"]);
  });

  // ── 12. Origem do checkout (G1) ───────────────────────────────────────────
  //
  // `client_reference_id` é escrito por quem cria a sessão — num Payment Link,
  // por quem abre a URL. Só sessão com prova de origem cria ou troca vínculo.

  /**
   * Janela em que o código anterior pode ter estado no ar (o build de produção
   * a registra; aqui, direto no banco). As janelas são globais: os casos de
   * recusa usam horários fora de qualquer janela deste arquivo.
   */
  const janela = (desde: Date | null, ate: Date) =>
    prisma.stripeJanelaLegado.create({ data: { desde, ate, origem: `teste_${RUN}` } });
  const casosDaSessao = (sessaoId: string) =>
    prisma.stripeRevisao.findMany({ where: { sessaoId }, select: { tipo: true, motivo: true, userId: true, assinatura: true } });
  const metaFixa = (planId: string) => ({ planId, subscriptionPlan: PLANS[planId].plan });

  it("Payment Link com o client_reference_id de outra pessoa: nem o invoice.paid nem o completed mexem no vínculo; um caso de revisão; nada da vítima é cancelado", async () => {
    const { userId: vitima, sub: propria } = await assinante("g1_vitima", "basico_mensal");
    const antes = await linha(vitima);
    // O link copia para a sessão só os metadados FIXOS dele.
    const ses = falso.sessaoExterna(
      { mode: "subscription", client_reference_id: vitima, metadata: metaFixa("pro_mensal"), subscription_data: { metadata: metaFixa("pro_mensal") } },
      { payment_link: "plink_test_g1" },
    );
    const sub = falso.completarCheckout(ses);
    const primeira = falso.retrato(sub).latest_invoice as string;
    assert.equal((await entregar("invoice.paid", falso.faturaObj(primeira))).status, 200);
    assert.deepEqual(await linha(vitima), antes, "invoice.paid antes do completed: vínculo intacto");

    const evt = `evt_${RUN}_g1_link`;
    const r = await Promise.all([0, 1].map(() => entregar("checkout.session.completed", falso.sessaoObj(ses), falso.estado.agora, evt)));
    assert.deepEqual(r.map((x) => x.status), [200, 200], "sem 500: reenviar não muda a prova");
    assert.equal((await entregar("checkout.session.completed", falso.sessaoObj(ses), falso.estado.agora, evt)).status, 200);
    assert.deepEqual(await linha(vitima), antes, "completed: vínculo intacto");
    assert.deepEqual(await casosDaSessao(ses), [{ tipo: "checkout_sem_prova", motivo: "metadata_de_outro_usuario", userId: vitima, assinatura: sub }]);
    assert.deepEqual(await operacoes(vitima), [], "nenhum cancelamento da assinatura da vítima");
    assert.deepEqual([falso.retrato(propria).status, falso.retrato(propria).cancel_at_period_end], ["active", false]);
  });

  it("sessão NOVA sem prova: sem operação (mesmo com e-mail e metadados certos), operação de outro usuário, plano ou sessão, ou inexistente — vínculo intacto e caso de revisão", async () => {
    const { userId, sub: propria } = await assinante("g1_novas", "basico_mensal");
    await prisma.user.update({ where: { id: userId }, data: { email: `${userId}@teste.invalid` } });
    const outro = await usuario("g1_novas_outro");
    const deOutraSessao = `prova_${userId}_outra_sessao`;
    await prisma.stripeOperacao.create({ data: { userId, tipo: "checkout", status: "concluida", planId: "pro_mensal", chave: deOutraSessao, referencia: `cs_${RUN}_outra` } });
    const antes = await linha(userId);
    // Criada com o código atual no ar: fora de qualquer janela de legado.
    const semJanela = agoraReal() + 6 * 3600;
    const casos: Array<[string, Record<string, string>]> = [
      ["sessao_nova_sem_operacao", { userId, ...metaFixa("pro_mensal") }],
      ["operacao_de_outro_usuario", { userId, ...metaFixa("pro_mensal"), operacao: `prova_${outro}_pro_mensal` }],
      ["operacao_de_outro_plano", { userId, ...metaFixa("pro_mensal"), operacao: `prova_${userId}_basico_mensal` }],
      ["operacao_de_outra_sessao", { userId, ...metaFixa("pro_mensal"), operacao: deOutraSessao }],
      ["operacao_inexistente", { userId, ...metaFixa("pro_mensal"), operacao: "dular-checkout-inexistente" }],
    ];
    for (const [motivo, metadata] of casos) {
      const ses = falso.sessaoExterna(
        { mode: "subscription", client_reference_id: userId, customer_email: `${userId}@teste.invalid`, metadata, subscription_data: { metadata } },
        { created: semJanela },
      );
      const sub = falso.completarCheckout(ses);
      assert.equal((await entregar("invoice.paid", falso.faturaObj(falso.retrato(sub).latest_invoice as string))).status, 200);
      assert.equal((await entregar("checkout.session.completed", falso.sessaoObj(ses))).status, 200);
      assert.deepEqual(await linha(userId), antes, motivo);
      assert.deepEqual((await casosDaSessao(ses)).map((c: any) => c.motivo), [motivo]);
    }
    assert.deepEqual(await operacoes(userId), []);
    assert.equal(falso.retrato(propria).cancel_at_period_end, false);
  });

  it("sessão da ROTA (com operação): o invoice.paid antes do completed já vincula; o completed confirma sem escrever", async () => {
    const userId = await usuario("g1_rota");
    assert.equal((await pedir(userId, "pro_mensal")).status, 200);
    const [sessao] = [...falso.estado.sessoes.values()];
    assert.match(sessao.params.metadata.operacao, /^dular-checkout-/);
    assert.equal(sessao.params.subscription_data.metadata.operacao, sessao.params.metadata.operacao);
    const sub = falso.completarCheckout(sessao.id);
    assert.equal((await entregar("invoice.paid", falso.faturaObj(falso.retrato(sub).latest_invoice as string))).status, 200);
    const criada = await linha(userId);
    assert.equal(criada.externalId, sub);
    assert.equal((await entregar("checkout.session.completed", falso.sessaoObj(sessao.id))).status, 200);
    assert.deepEqual(await linha(userId), criada);
    assert.deepEqual(await casosDaSessao(sessao.id), []);
  });

  it("LEGADO (criada pela rota anterior, dentro da janela): sem Payment Link e com o e-mail do usuário vincula; o invoice.paid antes espera o completed", async () => {
    const userId = await usuario("g1_legado");
    await prisma.user.update({ where: { id: userId }, data: { email: `${userId}@teste.invalid` } });
    await janela(null, new Date());
    const antesDoMarco = agoraReal() - 3600;
    const metadata = { userId, ...metaFixa("pro_mensal") };
    const ses = falso.sessaoExterna(
      { mode: "subscription", client_reference_id: userId, customer_email: ` ${userId.toUpperCase()}@TESTE.INVALID`, metadata, subscription_data: { metadata } },
      { created: antesDoMarco },
    );
    const sub = falso.completarCheckout(ses);
    assert.equal((await entregar("invoice.paid", falso.faturaObj(falso.retrato(sub).latest_invoice as string))).status, 200);
    assert.equal(await linha(userId), null, "sem operação nos metadados, o invoice.paid não cria vínculo");
    assert.equal((await entregar("checkout.session.completed", falso.sessaoObj(ses))).status, 200);
    const l = await linha(userId);
    assert.deepEqual([l.externalId, l.plan], [sub, "PREMIUM"]);
    assert.deepEqual(l.expiresAt, new Date(falso.retrato(sub).items.data[0].current_period_end * 1000), "o invoice.paid guardado entrou no período");
    assert.deepEqual(await casosDaSessao(ses), []);
  });

  for (const [motivo, ajuste] of [
    ["payment_link", { payment_link: "plink_test_legado", email: "certo" }],
    ["email_nao_confere", { email: "outro" }],
    ["email_nao_confere", { email: "sem" }],
  ] as const) {
    it(`LEGADO sem prova suficiente (${motivo}, e-mail ${ajuste.email}): vínculo intacto e caso de revisão`, async () => {
      const { userId, sub: propria } = await assinante(`g1_leg_${ajuste.email}_${motivo}`, "basico_mensal");
      if (ajuste.email !== "sem") await prisma.user.update({ where: { id: userId }, data: { email: `${userId}@teste.invalid` } });
      await janela(null, new Date());
      const antes = await linha(userId);
      const metadata = { userId, ...metaFixa("pro_mensal") };
      const ses = falso.sessaoExterna(
        {
          mode: "subscription",
          client_reference_id: userId,
          customer_email: ajuste.email === "outro" ? "outra.pessoa@teste.invalid" : `${userId}@teste.invalid`,
          metadata,
          subscription_data: { metadata },
        },
        { created: agoraReal() - 3600, payment_link: "payment_link" in ajuste ? ajuste.payment_link : undefined },
      );
      const sub = falso.completarCheckout(ses);
      assert.equal((await entregar("checkout.session.completed", falso.sessaoObj(ses))).status, 200);
      assert.deepEqual(await linha(userId), antes);
      assert.deepEqual(await casosDaSessao(ses), [{ tipo: "checkout_sem_prova", motivo, userId, assinatura: sub }]);
      assert.equal(falso.retrato(propria).cancel_at_period_end, false);
    });
  }

  /** Sessão como a rota ANTERIOR criava (sem operação), paga; devolve se vinculou e o motivo da recusa. */
  async function sessaoDoCodigoAnterior(sufixo: string, criada: number) {
    const userId = await usuario(sufixo);
    await prisma.user.update({ where: { id: userId }, data: { email: `${userId}@teste.invalid` } });
    const metadata = { userId, ...metaFixa("basico_mensal") };
    const ses = falso.sessaoExterna(
      { mode: "subscription", client_reference_id: userId, customer_email: `${userId}@teste.invalid`, metadata, subscription_data: { metadata } },
      { created: criada },
    );
    const sub = falso.completarCheckout(ses);
    assert.equal((await entregar("checkout.session.completed", falso.sessaoObj(ses))).status, 200);
    return { vinculou: (await linha(userId))?.externalId === sub, motivos: (await casosDaSessao(ses)).map((c: any) => c.motivo) };
  }

  it("JANELA depois de rollback: sessão sem operação criada enquanto o código atual servia é recusada; criada com o anterior no ar (entre a última presença e a troca real), vincula; depois da troca + folga, recusada", async () => {
    // Horários no futuro: nenhuma outra janela deste arquivo cobre esse trecho.
    const presenca = agoraReal() + 10 * 3600;
    const troca = presenca + 2 * 3600; // primeira presença verificada do código atual de volta
    await janela(new Date(presenca * 1000), new Date(troca * 1000));
    const casos: Array<[string, number, string | null]> = [
      ["g1_rb_antes", presenca - 30 * 60, "sessao_nova_sem_operacao"], // o código atual ainda servia
      ["g1_rb_dentro", presenca + 30 * 60, null], // o código anterior no ar (rollback)
      ["g1_rb_folga", troca + 30 * 60, null], // instâncias antigas terminando o que já atendiam
      ["g1_rb_depois", troca + 2 * 3600, "sessao_nova_sem_operacao"], // o código atual de volta
    ];
    for (const [sufixo, criada, motivo] of casos) {
      assert.deepEqual(await sessaoDoCodigoAnterior(sufixo, criada), { vinculou: !motivo, motivos: motivo ? [motivo] : [] }, sufixo);
    }
  });

  it("PROMOÇÃO ATRASADA (build pronto, promoção horas depois ou nunca): a janela fica aberta até a troca real; teto de 72 h; depois da troca, só a folga", async () => {
    // A janela que o build registra quando a produção é o código anterior: aberta (`ate` nulo).
    // `desde` 1 h à frente: nenhuma presença de outra suíte a fecha durante o teste.
    const desde = agoraReal() + 3600;
    const aberta = await prisma.stripeJanelaLegado.create({ data: { desde: new Date(desde * 1000), ate: null, origem: `teste_${RUN}` } });
    const abertaEm = Math.floor(aberta.createdAt.getTime() / 1000);
    try {
      // Promoção ainda não veio: o código anterior segue no ar e as sessões dele valem.
      assert.deepEqual(await sessaoDoCodigoAnterior("g1_atr_30min", desde + 30 * 60), { vinculou: true, motivos: [] });
      assert.deepEqual(await sessaoDoCodigoAnterior("g1_atr_2h", desde + 2 * 3600), { vinculou: true, motivos: [] }, "mais de 1 h depois do build: ainda vale");
      assert.deepEqual(
        await sessaoDoCodigoAnterior("g1_atr_teto", abertaEm + 73 * 3600),
        { vinculou: false, motivos: ["sessao_nova_sem_operacao"] },
        "aberta, vale no máximo 72 h desde o build",
      );
      // A troca real (a primeira presença verificada do código atual) fecha a janela.
      await prisma.stripeJanelaLegado.update({ where: { id: aberta.id }, data: { ate: new Date((desde + 3 * 3600) * 1000) } });
      assert.deepEqual(await sessaoDoCodigoAnterior("g1_atr_folga", desde + 3.5 * 3600), { vinculou: true, motivos: [] }, "folga depois da troca");
      assert.deepEqual(
        await sessaoDoCodigoAnterior("g1_atr_depois", desde + 5 * 3600),
        { vinculou: false, motivos: ["sessao_nova_sem_operacao"] },
        "o código atual no ar: sem operação, não vale",
      );
    } finally {
      await prisma.stripeJanelaLegado.delete({ where: { id: aberta.id } });
    }
  });

  it("TROCA REAL: a presença verificada fecha as janelas abertas — inclusive a de um build que nunca foi promovido", async () => {
    const antes = new Date(Date.now() - 2 * 3600_000);
    // Dois builds com o código anterior no ar: o primeiro nunca promovido, o segundo promovido agora.
    const naoPromovido = await prisma.stripeJanelaLegado.create({ data: { desde: antes, ate: null, origem: `teste_${RUN}` } });
    const promovido = await prisma.stripeJanelaLegado.create({ data: { desde: antes, ate: null, origem: `teste_${RUN}` } });
    limitesPresenca.ultimaMs = 0;
    const inicio = Date.now();
    await entregar("customer.subscription.updated", { id: `sub_${RUN}_troca_real`, object: "subscription", metadata: {} });
    for (const j of [naoPromovido, promovido]) {
      const ate = (await prisma.stripeJanelaLegado.findUnique({ where: { id: j.id } }))!.ate;
      assert.ok(ate && ate.getTime() >= inicio - 1000 && ate.getTime() <= Date.now() + 1000, "fechada na troca real");
    }
  });

  it("PRESENÇA só da produção: na Vercel, a instância só grava se /api/health da produção disser que a implantação no ar é ELA", async () => {
    const envOriginal = { ...process.env };
    const fetchOriginal = globalThis.fetch;
    // `prisma` de lib/prisma é um Proxy de leitura: o espião vai no client real.
    const real = (globalThis as unknown as { prisma: Record<string, unknown> }).prisma;
    const transacaoOriginal = real.$transaction;
    const gravacoes: unknown[] = [];
    const urls: string[] = [];
    try {
      Object.assign(process.env, {
        VERCEL: "1",
        VERCEL_ENV: "production",
        VERCEL_DEPLOYMENT_ID: "dpl_esta",
        VERCEL_PROJECT_PRODUCTION_URL: "dular.exemplo.invalid",
      });
      real.$transaction = async (ops: unknown) => void gravacoes.push(ops);
      const casos: Array<[string, () => Promise<Response>, number]> = [
        ["produção = código anterior", async () => new Response(JSON.stringify({ ok: true, status: "ok", ts: new Date().toISOString() })), 0],
        ["produção = outra implantação", async () => new Response(JSON.stringify({ checkoutComOperacao: true, implantacao: "dpl_outra" })), 0],
        ["saúde 503", async () => new Response("x", { status: 503 }), 0],
        ["saúde com HTML", async () => new Response("<html>"), 0],
        ["rede fora", async () => { throw new Error("rede"); }, 0],
        ["produção = esta implantação", async () => new Response(JSON.stringify({ checkoutComOperacao: true, implantacao: "dpl_esta" })), 1],
      ];
      for (const [nome, responder, esperado] of casos) {
        gravacoes.length = 0;
        globalThis.fetch = (async (url: string) => {
          urls.push(url);
          return responder();
        }) as never;
        limitesPresenca.ultimaMs = 0;
        await entregar("customer.subscription.updated", { id: `sub_${RUN}_presenca_prod`, object: "subscription", metadata: {} });
        assert.equal(gravacoes.length, esperado, nome);
      }
      assert.ok(urls.every((u) => u === "https://dular.exemplo.invalid/api/health"));
      // Implantação de preview (banco de staging): nunca grava.
      process.env.VERCEL_ENV = "preview";
      gravacoes.length = 0;
      limitesPresenca.ultimaMs = 0;
      await entregar("customer.subscription.updated", { id: `sub_${RUN}_presenca_prod`, object: "subscription", metadata: {} });
      assert.equal(gravacoes.length, 0, "preview");
    } finally {
      real.$transaction = transacaoOriginal;
      globalThis.fetch = fetchOriginal;
      for (const k of ["VERCEL", "VERCEL_ENV", "VERCEL_DEPLOYMENT_ID", "VERCEL_PROJECT_PRODUCTION_URL"]) {
        if (k in envOriginal) process.env[k] = envOriginal[k];
        else delete process.env[k];
      }
      limitesPresenca.ultimaMs = 0;
    }
  });

  it("PRESENÇA: webhook, pedido de plano e varredura gravam que este código está no ar (no máximo uma vez por intervalo)", async () => {
    const presenca = () => prisma.stripeMarco.findUnique({ where: { chave: "presenca_checkout_com_operacao" } });
    const original = limitesPresenca.intervaloMs;
    try {
      for (const [nome, gatilho] of [
        ["webhook", () => entregar("customer.subscription.updated", { id: `sub_${RUN}_presenca`, object: "subscription", metadata: {} })],
        ["pedido", async () => pedir(await usuario(`presenca_${Date.now().toString(36)}`), "basico_mensal")],
        ["varredura", () => varrer({ limite: 1 })],
      ] as const) {
        await prisma.stripeMarco.deleteMany({ where: { chave: "presenca_checkout_com_operacao" } });
        limitesPresenca.ultimaMs = 0;
        const antes = Date.now();
        await gatilho();
        const gravada = await presenca();
        assert.ok(gravada && gravada.em.getTime() >= antes - 1000 && gravada.em.getTime() <= Date.now() + 1000, `${nome}: presença gravada agora`);
      }
      // Dentro do intervalo, uma nova entrega não regrava.
      limitesPresenca.intervaloMs = 60 * 60_000;
      const foto = await presenca();
      await entregar("customer.subscription.updated", { id: `sub_${RUN}_presenca`, object: "subscription", metadata: {} });
      assert.deepEqual(await presenca(), foto);
    } finally {
      limitesPresenca.intervaloMs = original;
    }
  });
});

// Encerra o pool do Prisma ao fim do arquivo. Sem isto, as conexões ociosas
// seguram o processo por ~10 s (pg-pool: idleTimeoutMillis = 10 s,
// allowExitOnIdle = false) — e sem prazo se uma conexão ficar presa numa
// transação de um teste que falhou.
after(async () => {
  await (globalThis as { prisma?: { $disconnect(): Promise<void> } }).prisma?.$disconnect();
});
