import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { criarStripeFalso, type StripeFalso } from "./_stripeFalso";

/**
 * Stripe × loja (App Store / Google Play), issue #359, contra Postgres REAL,
 * com a Stripe SIMULADA (_stripeFalso) e a LOJA SIMULADA (troca de
 * `loja.verificar`/`loja.consultar`, de lib/lojas). Testes locais de ordem
 * controlada: a verificação e a consulta reais da loja NÃO existem, então nada
 * aqui prova a integração com a Apple ou o Google.
 *
 * Regras do dono:
 *  1. Compra válida na loja prevalece; a Stripe encerra ao fim do período
 *     pago, sem estorno automático.
 *  2. Checkout Stripe recusado enquanto a assinatura da loja estiver ativa.
 *  3. Pagamento Stripe que chegar com a loja vigente: cancelamento seguro da
 *     Stripe e caso de revisão manual.
 * Condições: titularidade verificada; uma compra, uma conta; o vínculo Stripe
 * não é apagado; checkout, compra de loja e vínculo pelo webhook um de cada
 * vez por pessoa; loja sem resposta não libera cobrança nem cancela; o
 * gravado não prova que a loja terminou; comprovante antigo não substitui
 * vínculo mais novo; período pago e dono da `sub_` (#348) preservados.
 *
 * Banco compartilhado com as outras suítes, que rodam ao mesmo tempo: aqui
 * nada varre o banco inteiro (só as operações de cada usuário do teste), e
 * nenhuma sessão de checkout fica aberta — a varredura de outra suíte não
 * consegue consultá-la. Uma operação deste arquivo pega pela varredura de
 * outro processo encontra a loja real (indisponível) e só fica pendente.
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
const SEGREDO = "whsec_ficticio_loja_canais_db";
const DIA = 86_400_000;

type Situacao = {
  externalId: string;
  storeProductId: string;
  compradaEm: Date;
  vigente: boolean;
  renova: boolean;
  expiraEm: Date | null;
  dono: string | null;
};

describe("Stripe × loja contra Postgres real (#359)", { skip: EXIGIDO ? false : PULAR }, () => {
  let prisma: any;
  let stripeCliente: any;
  let PLANS: any;
  let lojas: any;
  let ErroDeLoja: any;
  let tokenDaConta: (userId: string) => string;
  let registrarCompraDaLoja: (...a: any[]) => Promise<string>;
  let postLoja: (r: Request) => Promise<Response>;
  let postCheckout: (r: Request) => Promise<Response>;
  let postWebhook: (r: Request) => Promise<Response>;
  let retomarOperacoes: (filtro: { userId?: string }) => Promise<unknown>;
  let makeAuthHeaders: (u: string, r: any) => Record<string, string>;
  let limitesPresenca: { intervaloMs: number; ultimaMs: number };
  let falso: StripeFalso;
  let originaisDaLoja: { verificar: unknown; consultar: unknown } | null = null;
  const RUN = `t_loja_${Date.now().toString(36)}`;
  const usuarios: string[] = [];
  let seq = 0;
  let ip = 0;
  let testemunha = "";
  let fotoTestemunha: unknown = null;

  /** A loja simulada: a situação ATUAL de cada compra, por identidade. */
  const loja = {
    compras: new Map<string, Situacao>(),
    verificacaoFora: false,
    consultaFora: false,
    consultas: 0,
    /** Segura a consulta (e, com ela, a trava da pessoa) até ser solta. */
    pausa: null as Promise<void> | null,
    aoConsultar: null as null | (() => void),
  };

  async function usuario(sufixo: string) {
    const id = `${RUN}_${sufixo}`;
    await prisma.user.create({ data: { id, nome: `Teste loja ${sufixo}`, role: "DIARISTA" } });
    usuarios.push(id);
    await prisma.stripeOperacao.createMany({
      data: Object.keys(PLANS).map((planId) => ({ userId: id, tipo: "checkout", status: "concluida", planId, chave: `prova_${id}_${planId}` })),
    });
    return id;
  }
  const meta = (userId: string, planId: string, operacao = `prova_${userId}_${planId}`) => ({
    userId,
    planId,
    subscriptionPlan: PLANS[planId].plan,
    operacao,
  });

  /** Compra feita na loja (ainda não apresentada ao servidor). */
  function compraNaLoja(userId: string, sufixo: string, planId: string, extra: Partial<Situacao> = {}): string {
    const externalId = `apple_${RUN}_${sufixo}`;
    loja.compras.set(externalId, {
      externalId,
      storeProductId: PLANS[planId].storeProductId,
      compradaEm: new Date(),
      vigente: true,
      renova: true,
      expiraEm: new Date(Date.now() + 30 * DIA),
      dono: tokenDaConta(userId),
      ...extra,
    });
    return externalId;
  }
  async function apresentar(userId: string, externalId: string) {
    const produtoId = loja.compras.get(externalId)?.storeProductId ?? PLANS.basico_mensal.storeProductId;
    const res = await postLoja(
      new Request("http://test/api/billing/loja", {
        method: "POST",
        headers: { "content-type": "application/json", ...makeAuthHeaders(userId, "DIARISTA") },
        body: JSON.stringify({ plataforma: "ios", produtoId, comprovante: `tx_${externalId}` }),
      }),
    );
    return { status: res.status, corpo: await res.json() };
  }
  async function pedir(userId: string, planId: string) {
    ip += 1;
    const res = await postCheckout(
      new Request("http://test/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": `10.35.${ip >> 8}.${ip & 255}`, ...makeAuthHeaders(userId, "DIARISTA") },
        body: JSON.stringify({ planId }),
      }),
    );
    return { status: res.status, corpo: await res.json() };
  }
  async function entregar(tipo: string, objeto: unknown, criado = falso.estado.agora) {
    const payload = JSON.stringify({ id: `evt_${RUN}_${++seq}`, object: "event", type: tipo, api_version: "2026-06-24.dahlia", created: criado, livemode: false, data: { object: objeto } });
    const assinatura = stripeCliente.webhooks.generateTestHeaderString({ payload, secret: SEGREDO });
    const res = await postWebhook(new Request("http://test/api/webhooks/stripe", { method: "POST", headers: { "stripe-signature": assinatura }, body: payload }));
    return res.status;
  }

  const linha = (userId: string) =>
    prisma.subscription.findUnique({ where: { userId }, select: { provider: true, externalId: true, plan: true, status: true, startedAt: true, expiresAt: true } });
  const comprasGravadas = (userId: string) =>
    prisma.assinaturaLoja.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { externalId: true, plan: true, vigente: true, renova: true } });
  const operacoes = (userId: string) =>
    prisma.stripeOperacao.findMany({
      where: { userId, NOT: { chave: { startsWith: "prova_" } } },
      orderBy: { createdAt: "asc" },
      select: { tipo: true, status: true, substituida: true, erro: true },
    });
  const encerramentos = async (userId: string) => (await operacoes(userId)).filter((o: any) => o.tipo === "encerrar_por_loja");
  const revisoes = (userId: string) => prisma.stripeRevisao.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { tipo: true, assinatura: true } });
  const cobrancas = (sub: string) => falso.estado.cobrancas.filter((c) => c.sub === sub).map((c) => c.motivo);
  const escritas = (metodo: string) => falso.estado.escritas.filter((e) => e.startsWith(metodo)).length;
  const vaiRenovar = (sub: string) => falso.cobrandoNaRenovacao().includes(sub);
  async function acesso(userId: string) {
    const { checkFeatureAccess } = await import("../../src/lib/featureGate");
    return (await checkFeatureAccess(userId, "SOLICITACOES_MES")).plan;
  }

  /**
   * Checkout pago na Stripe simulada, como a rota deixa: a operação `checkout`
   * com a prova de origem, a assinatura e a sessão paga. Os eventos ainda não
   * chegaram. Sem sessão aberta no banco (ver o cabeçalho).
   */
  async function checkoutPago(userId: string, planId: string) {
    const sub = falso.criarAssinatura({ metadata: meta(userId, planId), plano: PLANS[planId] });
    const chave = `prova_${sub}`;
    await prisma.stripeOperacao.create({ data: { userId, tipo: "checkout", status: "concluida", planId, externalId: sub, chave } });
    falso.estado.assinaturas.get(sub)!.metadata.operacao = chave;
    falso.estado.faturas.get(falso.retrato(sub).latest_invoice as string)!.metadata.operacao = chave;
    const sessao = {
      id: `cs_${RUN}_${++seq}`,
      object: "checkout.session",
      mode: "subscription",
      payment_status: "paid",
      client_reference_id: userId,
      subscription: sub,
      metadata: meta(userId, planId, chave),
      created: falso.estado.agora,
    };
    return { sub, sessao };
  }
  const primeiraFatura = (sub: string) => entregar("invoice.paid", falso.faturaObj(falso.retrato(sub).latest_invoice as string));
  async function eventosDoPagamento(sub: string, sessao: unknown) {
    assert.equal(await primeiraFatura(sub), 200);
    assert.equal(await entregar("checkout.session.completed", sessao), 200);
  }
  /** Assinante Stripe como o Checkout deixa: primeira fatura paga e vínculo criado. */
  async function assinanteStripe(sufixo: string, planId: string) {
    const userId = await usuario(sufixo);
    const { sub } = await checkoutPago(userId, planId);
    assert.equal(await primeiraFatura(sub), 200);
    assert.equal((await linha(userId)).externalId, sub);
    return { userId, sub };
  }
  /**
   * Pedido de plano que passa pelo guarda da loja e chega à Stripe, sem deixar
   * sessão aberta: a criação da sessão é recusada (503 TENTE_NOVAMENTE).
   */
  async function pedirAteAStripe(userId: string, planId: string) {
    let tentativas = 0;
    falso.estado.recusarAntes = (metodo) => metodo === "checkout.sessions.create" && ++tentativas > 0;
    try {
      const r = await pedir(userId, planId);
      return { ...r, chegouAStripe: tentativas > 0 };
    } finally {
      falso.estado.recusarAntes = null;
      await prisma.stripeOperacao.updateMany({ where: { userId, tipo: "checkout", status: { in: ["pendente", "aguardando"] } }, data: { status: "descartada" } });
    }
  }
  const retomar = (userId: string) => retomarOperacoes({ userId });

  before(async () => {
    if (PULAR) throw new Error(`SAFESCORE_DB_REQUIRED=1, mas ${PULAR}`);
    process.env.DATABASE_URL = URL_BANCO;
    process.env.STRIPE_WEBHOOK_SECRET = SEGREDO;
    process.env.STRIPE_SECRET_KEY ??= "sk_test_ficticio_sem_uso_de_rede";
    // Credenciais fictícias: o fluxo continua indisponível mesmo com elas.
    Object.assign(process.env, {
      APPLE_IAP_KEY_ID: "ficticio",
      APPLE_IAP_ISSUER_ID: "ficticio",
      APPLE_IAP_PRIVATE_KEY: "ficticio",
      APPLE_IAP_BUNDLE_ID: "br.com.dular.ficticio",
      GOOGLE_PLAY_PACKAGE_NAME: "br.com.dular.ficticio",
      GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: "{}",
    });
    ({ prisma } = await import("../../src/lib/prisma"));
    const modStripe = await import("../../src/lib/stripe");
    stripeCliente = modStripe.stripe;
    PLANS = modStripe.PLANS;
    lojas = await import("../../src/lib/lojas");
    ({ ErroDeLoja, tokenDaConta } = lojas);
    ({ registrarCompraDaLoja, retomarOperacoes } = await import("../../src/lib/trocaDePlano"));
    postLoja = (await import("../../src/app/api/billing/loja/route")).POST;
    postCheckout = (await import("../../src/app/api/billing/checkout/route")).POST;
    postWebhook = (await import("../../src/app/api/webhooks/stripe/route")).POST;
    ({ makeAuthHeaders } = await import("./_helpers"));
    ({ limitesPresenca } = await import("../../src/lib/origemDoCheckout"));
    limitesPresenca.intervaloMs = Number.MAX_SAFE_INTEGER;

    originaisDaLoja = { verificar: lojas.loja.verificar, consultar: lojas.loja.consultar };
    lojas.loja.verificar = async (_provider: string, comprovante: string) => {
      if (loja.verificacaoFora) throw new ErroDeLoja("LOJA_INDISPONIVEL", "loja fora (simulado)");
      const s = loja.compras.get(comprovante.replace(/^tx_/, ""));
      if (!s) throw new ErroDeLoja("COMPRA_INVALIDA", "compra inexistente (simulado)");
      return { ...s };
    };
    lojas.loja.consultar = async (_provider: string, externalId: string) => {
      loja.consultas += 1;
      loja.aoConsultar?.();
      if (loja.pausa) await loja.pausa;
      if (loja.consultaFora) throw new ErroDeLoja("LOJA_INDISPONIVEL", "loja fora (simulado)");
      const s = loja.compras.get(externalId);
      if (!s) throw new ErroDeLoja("COMPRA_INVALIDA", "compra inexistente (simulado)");
      return { ...s };
    };

    // Assinatura e compra de loja de outro usuário, gravadas antes de tudo: não podem mudar.
    testemunha = await usuario("testemunha");
    await prisma.subscription.create({
      data: { userId: testemunha, plan: "PREMIUM", status: "ACTIVE", provider: "STRIPE", externalId: `sub_${RUN}_testemunha`, expiresAt: new Date("2027-01-01T00:00:00Z") },
    });
    await prisma.assinaturaLoja.create({
      data: { userId: testemunha, provider: "APPLE", externalId: `apple_${RUN}_testemunha`, storeProductId: PLANS.pro_mensal.storeProductId, plan: "PREMIUM", compradaEm: new Date(), vigente: true, renova: true, expiraEm: new Date("2027-01-01T00:00:00Z"), verificadaEm: new Date() },
    });
    fotoTestemunha = [await linha(testemunha), await comprasGravadas(testemunha)];
  });

  beforeEach(() => {
    falso?.restaurar();
    // Relógio da Stripe simulada 1 h antes de agora: o vínculo Stripe começa antes da compra na loja.
    falso = criarStripeFalso(Math.floor(Date.now() / 1000) - 3600);
    falso.instalar(stripeCliente);
    loja.verificacaoFora = false;
    loja.consultaFora = false;
  });

  afterEach(() => {
    falso.estado.recusarAntes = null;
  });

  after(async () => {
    falso?.restaurar();
    if (originaisDaLoja) Object.assign(lojas.loja, originaisDaLoja);
    if (!prisma) return;
    assert.deepEqual([await linha(testemunha), await comprasGravadas(testemunha)], fotoTestemunha, "assinaturas de outro usuário intactas");
    await prisma.stripeOperacao.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.stripeRevisao.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.assinaturaLoja.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.subscription.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.stripeEventoAssinatura.deleteMany({ where: { externalId: { startsWith: "sub_falso" } } });
    await prisma.user.deleteMany({ where: { id: { in: usuarios } } });
  });

  // ── Fluxo indisponível ────────────────────────────────────────────────────

  it("o fluxo da loja segue INDISPONÍVEL: com credencial, lojasProntas é falso e o verificador real responde 503 sem gravar", async () => {
    assert.deepEqual(lojas.lojasProntas(), { apple: false, google: false });
    const userId = await usuario("indisponivel");
    const externalId = compraNaLoja(userId, "indisponivel", "pro_mensal");
    const simulado = lojas.loja.verificar;
    lojas.loja.verificar = originaisDaLoja!.verificar;
    try {
      const r = await apresentar(userId, externalId);
      assert.equal(r.status, 503);
      assert.equal(r.corpo.error.code, "LOJA_INDISPONIVEL");
    } finally {
      lojas.loja.verificar = simulado;
    }
    assert.deepEqual(await comprasGravadas(userId), []);
  });

  // ── Verificação e titularidade ────────────────────────────────────────────

  it("loja sem resposta na verificação: 503, nada gravado, a Stripe intocada", async () => {
    const { userId, sub } = await assinanteStripe("verif_fora", "basico_mensal");
    const externalId = compraNaLoja(userId, "verif_fora", "pro_mensal");
    loja.verificacaoFora = true;
    const r = await apresentar(userId, externalId);
    assert.equal(r.status, 503);
    assert.deepEqual(await comprasGravadas(userId), []);
    assert.deepEqual(await operacoes(userId), []);
    assert.equal(falso.retrato(sub).cancel_at_period_end, false);
    assert.equal(escritas("subscriptions."), 0);
  });

  it("compra sem titularidade (sem token, ou com o de outra conta): 403, nada gravado nem cancelado", async () => {
    const { userId, sub } = await assinanteStripe("sem_dono", "basico_mensal");
    const outro = await usuario("sem_dono_outro");
    for (const dono of [null, tokenDaConta(outro)]) {
      const externalId = compraNaLoja(userId, `sem_dono_${dono ? "outro" : "nulo"}`, "pro_mensal", { dono });
      const r = await apresentar(userId, externalId);
      assert.equal(r.status, 403);
      assert.equal(r.corpo.error.code, "COMPRA_SEM_TITULARIDADE");
    }
    assert.deepEqual(await comprasGravadas(userId), []);
    assert.equal(falso.retrato(sub).cancel_at_period_end, false);
  });

  it("uma compra, uma conta: a mesma compra para outra conta é recusada, também ao mesmo tempo", async () => {
    const [a, b] = [await usuario("uma_a"), await usuario("uma_b")];
    const externalId = compraNaLoja(a, "uma", "pro_mensal");
    const situacao = loja.compras.get(externalId)!;
    const resultados = await Promise.all([a, b].map((u) => registrarCompraDaLoja(u, "APPLE", situacao, PLANS.pro_mensal)));
    assert.deepEqual([...resultados].sort(), ["de_outra_conta", "registrada"]);
    assert.equal(await prisma.assinaturaLoja.count({ where: { externalId } }), 1);
    const dono = (await prisma.assinaturaLoja.findFirst({ where: { externalId } })).userId;
    assert.equal(await registrarCompraDaLoja(dono === a ? b : a, "APPLE", situacao, PLANS.pro_mensal), "de_outra_conta");
  });

  // ── Regra 1: a loja prevalece; a Stripe encerra no fim do período pago ─────

  it("Stripe ativa → compra válida na loja: registra a compra, o vínculo Stripe fica, a Stripe encerra no fim do período; nada cobrado", async () => {
    const { userId, sub } = await assinanteStripe("regra1", "basico_mensal");
    const vinculoAntes = await linha(userId);
    const externalId = compraNaLoja(userId, "regra1", "pro_mensal");

    const r = await apresentar(userId, externalId);
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    assert.equal(r.corpo.plan, "PREMIUM");
    assert.deepEqual(await linha(userId), vinculoAntes, "o vínculo Stripe não é apagado nem trocado");
    assert.deepEqual(await comprasGravadas(userId), [{ externalId, plan: "PREMIUM", vigente: true, renova: true }]);
    assert.deepEqual(await encerramentos(userId), [{ tipo: "encerrar_por_loja", status: "concluida", substituida: sub, erro: null }]);
    const retrato = falso.retrato(sub);
    assert.equal(retrato.status, "active", "o período pago segue");
    assert.equal(retrato.cancel_at_period_end, true);
    assert.equal(vaiRenovar(sub), false, "não renova");
    assert.deepEqual(cobrancas(sub), ["subscription_create"], "nenhuma cobrança nova");
    assert.deepEqual(await revisoes(userId), []);
    assert.equal(await acesso(userId), "PREMIUM", "vale o maior plano pago");
  });

  it("o mesmo comprovante 3× seguidas e 3× ao mesmo tempo: uma compra, uma operação, um encerramento", async () => {
    const { userId, sub } = await assinanteStripe("repetido", "basico_mensal");
    const externalId = compraNaLoja(userId, "repetido", "pro_mensal");
    for (let i = 0; i < 3; i++) assert.equal((await apresentar(userId, externalId)).status, 200);
    const simultaneos = await Promise.all([1, 2, 3].map(() => apresentar(userId, externalId)));
    for (const s of simultaneos) assert.ok(s.status === 200 || s.corpo?.error?.code === "OPERACAO_EM_ANDAMENTO", JSON.stringify(s));
    assert.equal(await prisma.assinaturaLoja.count({ where: { externalId } }), 1);
    assert.equal((await encerramentos(userId)).length, 1);
    assert.equal(escritas("subscriptions.update"), 1);
    assert.equal(falso.retrato(sub).cancel_at_period_end, true);
  });

  it("renovação Stripe ainda NÃO paga quando a compra chega: o período pago acabou — cancela já e anula a fatura", async () => {
    const { userId, sub } = await assinanteStripe("rascunho", "basico_mensal");
    const fid = falso.virada(sub); // rascunho da renovação; a Stripe cobraria em ~1 h
    const externalId = compraNaLoja(userId, "rascunho", "pro_mensal");
    assert.equal((await apresentar(userId, externalId)).status, 200);
    assert.equal(falso.retrato(sub).status, "canceled");
    assert.equal(falso.faturaObj(fid).status, "void");
    falso.finalizarRenovacao(fid);
    assert.deepEqual(cobrancas(sub), ["subscription_create"], "a renovação não foi cobrada");
    assert.deepEqual(await revisoes(userId), []);
  });

  it("Stripe fora na compra: a compra vale, o encerramento fica pendente; renovação paga antes da retomada vira caso de revisão, sem estorno", async () => {
    const { userId, sub } = await assinanteStripe("stripe_fora", "basico_mensal");
    const externalId = compraNaLoja(userId, "stripe_fora", "pro_mensal");
    falso.estado.recusarAntes = (metodo) => metodo.startsWith("subscriptions.");
    const r = await apresentar(userId, externalId);
    assert.equal(r.status, 200, "a compra da loja não é recusada por causa da Stripe");
    assert.deepEqual((await encerramentos(userId)).map((o: any) => o.status), ["pendente"]);

    falso.estado.recusarAntes = null;
    const fid = falso.virada(sub);
    assert.equal(await entregar("invoice.created", falso.faturaObj(fid)), 200);
    // A retomada no rascunho já agiu: cancelou e anulou antes da cobrança.
    assert.equal(falso.faturaObj(fid).status, "void");
    assert.deepEqual(cobrancas(sub), ["subscription_create"]);
    assert.deepEqual((await encerramentos(userId)).map((o: any) => o.status), ["concluida"]);
  });

  it("renovação Stripe PAGA depois da compra na loja (encerramento ainda pendente): caso de revisão; encerra no fim do período", async () => {
    const { userId, sub } = await assinanteStripe("paga_depois", "basico_mensal");
    const externalId = compraNaLoja(userId, "paga_depois", "pro_mensal");
    falso.estado.recusarAntes = (metodo) => metodo.startsWith("subscriptions.") || metodo.startsWith("invoices.");
    assert.equal((await apresentar(userId, externalId)).status, 200);
    const fid = falso.virada(sub);
    assert.equal(await entregar("invoice.created", falso.faturaObj(fid)), 200);
    falso.finalizarRenovacao(fid);
    falso.estado.recusarAntes = null;
    assert.equal(await entregar("invoice.paid", falso.faturaObj(fid)), 200);
    assert.deepEqual(await revisoes(userId), [{ tipo: "renovacao_paga_com_loja", assinatura: null }]);
    assert.equal(falso.retrato(sub).cancel_at_period_end, true);
    assert.deepEqual(cobrancas(sub), ["subscription_create", "subscription_cycle"], "nada estornado automaticamente");
    assert.deepEqual(await encerramentos(userId), [{ tipo: "encerrar_por_loja", status: "concluida", substituida: sub, erro: "cobranca_em_revisao" }]);
  });

  it("loja sem resposta na execução: nada é cancelado; quando a loja responde, a Stripe encerra", async () => {
    const { userId, sub } = await assinanteStripe("consulta_fora", "basico_mensal");
    const externalId = compraNaLoja(userId, "consulta_fora", "pro_mensal");
    loja.consultaFora = true;
    assert.equal((await apresentar(userId, externalId)).status, 200);
    assert.deepEqual(await encerramentos(userId), [{ tipo: "encerrar_por_loja", status: "pendente", substituida: sub, erro: "loja_indisponivel" }]);
    assert.equal(falso.retrato(sub).cancel_at_period_end, false);
    assert.equal(escritas("subscriptions."), 0);

    loja.consultaFora = false;
    await retomar(userId);
    assert.equal((await encerramentos(userId))[0].status, "concluida");
    assert.equal(falso.retrato(sub).cancel_at_period_end, true);
  });

  it("a loja diz que a compra não vale mais quando o encerramento executa: descarta; a Stripe segue", async () => {
    const { userId, sub } = await assinanteStripe("nao_vale_mais", "basico_mensal");
    const externalId = compraNaLoja(userId, "nao_vale_mais", "pro_mensal");
    falso.estado.recusarAntes = (metodo) => metodo.startsWith("subscriptions.");
    assert.equal((await apresentar(userId, externalId)).status, 200);
    Object.assign(loja.compras.get(externalId)!, { vigente: false, renova: false, expiraEm: new Date(Date.now() - 1000) });
    falso.estado.recusarAntes = null;
    await retomar(userId);
    assert.deepEqual(await encerramentos(userId), [{ tipo: "encerrar_por_loja", status: "descartada", substituida: sub, erro: "loja_nao_vigente" }]);
    assert.equal(falso.retrato(sub).cancel_at_period_end, false);
    assert.equal(await acesso(userId), "BASIC");
  });

  it("a loja tenta cobrar de novo, sem período em curso (renova, não vigente): espera — nem cancela nem descarta", async () => {
    const { userId, sub } = await assinanteStripe("loja_retentando", "basico_mensal");
    const externalId = compraNaLoja(userId, "loja_retentando", "pro_mensal");
    falso.estado.recusarAntes = (metodo) => metodo.startsWith("subscriptions.");
    assert.equal((await apresentar(userId, externalId)).status, 200);
    falso.estado.recusarAntes = null;
    Object.assign(loja.compras.get(externalId)!, { vigente: false, renova: true, expiraEm: new Date(Date.now() - 1000) });
    await retomar(userId);
    assert.deepEqual(await encerramentos(userId), [{ tipo: "encerrar_por_loja", status: "pendente", substituida: sub, erro: "loja_renovando_sem_periodo" }]);
    assert.equal(falso.retrato(sub).cancel_at_period_end, false);

    // A loja conseguiu cobrar: a compra vale de novo, e a Stripe encerra.
    Object.assign(loja.compras.get(externalId)!, { vigente: true, expiraEm: new Date(Date.now() + 30 * DIA) });
    await retomar(userId);
    assert.equal((await encerramentos(userId))[0].status, "concluida");
    assert.equal(falso.retrato(sub).cancel_at_period_end, true);
  });

  it("sub_ Stripe sem o mesmo dono nos metadados (#348): não é encerrada", async () => {
    const userId = await usuario("dono_alheio");
    const outro = await usuario("dono_alheio_outro");
    const sub = falso.criarAssinatura({ metadata: meta(outro, "basico_mensal"), plano: PLANS.basico_mensal });
    await prisma.subscription.create({
      data: { userId, plan: "BASIC", status: "ACTIVE", provider: "STRIPE", externalId: sub, startedAt: new Date(Date.now() - DIA), expiresAt: new Date(Date.now() + 20 * DIA) },
    });
    const externalId = compraNaLoja(userId, "dono_alheio", "pro_mensal");
    assert.equal((await apresentar(userId, externalId)).status, 200);
    assert.deepEqual(await encerramentos(userId), [{ tipo: "encerrar_por_loja", status: "falhou", substituida: sub, erro: "antiga_de_outro_usuario" }]);
    assert.equal(falso.retrato(sub).cancel_at_period_end, false);
  });

  it("assinatura de loja ANTIGA que segue renovando (ativa na consulta): a data original não decide — a loja prevalece, a Stripe encerra e as duas cobranças vão para revisão", async () => {
    const { userId, sub } = await assinanteStripe("antiga_renovando", "basico_mensal");
    // Comprada 40 dias antes da Stripe e renovando desde então; nunca apresentada.
    const externalId = compraNaLoja(userId, "antiga_renovando", "pro_mensal", { compradaEm: new Date(Date.now() - 40 * DIA) });
    assert.equal((await apresentar(userId, externalId)).status, 200);
    assert.deepEqual(await encerramentos(userId), [{ tipo: "encerrar_por_loja", status: "concluida", substituida: sub, erro: "cobranca_em_revisao" }]);
    assert.equal(falso.retrato(sub).cancel_at_period_end, true, "a Stripe encerra no fim do período pago");
    assert.equal(falso.retrato(sub).status, "active");
    assert.deepEqual(await revisoes(userId), [{ tipo: "loja_anterior_ao_vinculo", assinatura: sub }]);
    assert.equal((await linha(userId)).externalId, sub, "o vínculo Stripe fica no histórico");
    assert.equal(vaiRenovar(sub), false);
  });

  it("assinatura de loja em período mas SEM renovação (cancelada na loja): não há segunda cobrança recorrente — a Stripe não encerra; se a renovação voltar, encerra", async () => {
    const { userId, sub } = await assinanteStripe("sem_renovacao", "basico_mensal");
    const externalId = compraNaLoja(userId, "sem_renovacao", "pro_mensal", { compradaEm: new Date(Date.now() - 20 * DIA), renova: false });
    assert.equal((await apresentar(userId, externalId)).status, 200);
    assert.deepEqual(await encerramentos(userId), [{ tipo: "encerrar_por_loja", status: "pendente", substituida: sub, erro: "loja_em_periodo_sem_renovacao" }]);
    assert.equal(falso.retrato(sub).cancel_at_period_end, false, "a Stripe, única que renova, segue");
    assert.deepEqual(await revisoes(userId), []);
    assert.equal(await acesso(userId), "PREMIUM", "a loja ainda vale até o fim do período dela");

    // A pessoa religa a renovação na loja: as duas cobrariam; a loja prevalece.
    loja.compras.get(externalId)!.renova = true;
    await retomar(userId);
    assert.equal(falso.retrato(sub).cancel_at_period_end, true);
    assert.deepEqual(await revisoes(userId), [{ tipo: "loja_anterior_ao_vinculo", assinatura: sub }]);
  });

  it("assinatura de loja em período sem renovação que termina: a espera é descartada e a Stripe segue", async () => {
    const { userId, sub } = await assinanteStripe("sem_renovacao_fim", "basico_mensal");
    const externalId = compraNaLoja(userId, "sem_renovacao_fim", "pro_mensal", { renova: false });
    assert.equal((await apresentar(userId, externalId)).status, 200);
    Object.assign(loja.compras.get(externalId)!, { vigente: false, expiraEm: new Date(Date.now() - 1000) });
    await retomar(userId);
    assert.deepEqual(await encerramentos(userId), [{ tipo: "encerrar_por_loja", status: "descartada", substituida: sub, erro: "loja_nao_vigente" }]);
    assert.equal(falso.retrato(sub).cancel_at_period_end, false);
    assert.equal(await acesso(userId), "BASIC");
  });

  it("compra que a loja diz fora do período: 409, fica no histórico, não concede nem cancela", async () => {
    const { userId, sub } = await assinanteStripe("vencida", "basico_mensal");
    const externalId = compraNaLoja(userId, "vencida", "pro_mensal", { vigente: false, renova: false, expiraEm: new Date(Date.now() - DIA) });
    const r = await apresentar(userId, externalId);
    assert.equal(r.status, 409);
    assert.equal(r.corpo.error.code, "COMPRA_VENCIDA");
    assert.deepEqual(await comprasGravadas(userId), [{ externalId, plan: "PREMIUM", vigente: false, renova: false }]);
    assert.deepEqual(await operacoes(userId), []);
    assert.equal(falso.retrato(sub).cancel_at_period_end, false);
    assert.equal(await acesso(userId), "BASIC");
  });

  // ── Regra 2: sem checkout Stripe com a loja ativa ─────────────────────────

  it("loja ativa: checkout recusado (409 ASSINATURA_NA_LOJA) e nenhuma sessão criada", async () => {
    const userId = await usuario("r2_ativa");
    assert.equal((await apresentar(userId, compraNaLoja(userId, "r2_ativa", "basico_mensal"))).status, 200);
    const r = await pedir(userId, "pro_mensal");
    assert.equal(r.status, 409);
    assert.equal(r.corpo.error.code, "ASSINATURA_NA_LOJA");
    assert.equal(escritas("checkout.sessions.create"), 0);
  });

  it("loja sem resposta: checkout recusado (503 LOJA_INDISPONIVEL) e nenhuma sessão criada", async () => {
    const userId = await usuario("r2_fora");
    assert.equal((await apresentar(userId, compraNaLoja(userId, "r2_fora", "basico_mensal"))).status, 200);
    loja.consultaFora = true;
    const r = await pedir(userId, "pro_mensal");
    assert.equal(r.status, 503);
    assert.equal(r.corpo.error.code, "LOJA_INDISPONIVEL");
    assert.equal(escritas("checkout.sessions.create"), 0);
  });

  it("o gravado não prova que a loja terminou: expiraEm local no passado, mas a loja ainda renova → recusado", async () => {
    const userId = await usuario("r2_local");
    const externalId = compraNaLoja(userId, "r2_local", "basico_mensal");
    assert.equal((await apresentar(userId, externalId)).status, 200);
    await prisma.assinaturaLoja.updateMany({ where: { externalId }, data: { vigente: false, renova: false, expiraEm: new Date(Date.now() - DIA) } });
    Object.assign(loja.compras.get(externalId)!, { vigente: false, renova: true, expiraEm: new Date(Date.now() - DIA) });
    const r = await pedir(userId, "pro_mensal");
    assert.equal(r.status, 409);
    assert.equal(r.corpo.error.code, "ASSINATURA_NA_LOJA");
  });

  it("a loja diz encerrada (fora do período e sem renovação): o checkout é liberado", async () => {
    const userId = await usuario("r2_encerrada");
    const externalId = compraNaLoja(userId, "r2_encerrada", "basico_mensal");
    assert.equal((await apresentar(userId, externalId)).status, 200);
    Object.assign(loja.compras.get(externalId)!, { vigente: false, renova: false, expiraEm: new Date(Date.now() - DIA) });
    const r = await pedirAteAStripe(userId, "pro_mensal");
    assert.ok(r.chegouAStripe, "o pedido passou pela loja e chegou à criação da sessão");
    assert.equal(r.corpo.error.code, "TENTE_NOVAMENTE");
  });

  it("sem compra de loja, a loja nem é consultada (#348 inalterado)", async () => {
    const userId = await usuario("r2_sem_loja");
    const antes = loja.consultas;
    assert.ok((await pedirAteAStripe(userId, "pro_mensal")).chegouAStripe);
    assert.equal(loja.consultas, antes);
  });

  it("assinante Stripe com loja ativa também não troca de plano pela Stripe", async () => {
    const { userId, sub } = await assinanteStripe("r2_troca", "basico_mensal");
    assert.equal((await apresentar(userId, compraNaLoja(userId, "r2_troca", "pro_mensal"))).status, 200);
    const r = await pedir(userId, "pro_anual");
    assert.equal(r.status, 409);
    assert.equal(r.corpo.error.code, "ASSINATURA_NA_LOJA");
    assert.deepEqual(cobrancas(sub), ["subscription_create"]);
  });

  // ── Regra 3: pagamento Stripe com a loja vigente ──────────────────────────

  it("checkout aberto antes da compra na loja e pago depois: vínculo Stripe registrado, a Stripe encerra no fim do período e o pagamento vai para revisão", async () => {
    const userId = await usuario("r3_aberta");
    assert.equal((await apresentar(userId, compraNaLoja(userId, "r3_aberta", "pro_mensal"))).status, 200);
    const { sub, sessao } = await checkoutPago(userId, "basico_mensal");
    await eventosDoPagamento(sub, sessao);

    assert.equal((await linha(userId)).externalId, sub, "o vínculo Stripe fica registrado (histórico do canal)");
    assert.deepEqual(await encerramentos(userId), [{ tipo: "encerrar_por_loja", status: "concluida", substituida: sub, erro: "cobranca_em_revisao" }]);
    assert.equal(falso.retrato(sub).cancel_at_period_end, true);
    assert.equal(falso.retrato(sub).status, "active", "o período pago segue");
    assert.deepEqual(await revisoes(userId), [{ tipo: "pagamento_stripe_com_loja", assinatura: sub }]);
    assert.equal(await acesso(userId), "PREMIUM");
  });

  it("pagamento Stripe ANTES da compra na loja, com os eventos atrasados: mesmo resultado; o pedido seguinte esbarra na loja, não em confirmação presa", async () => {
    const userId = await usuario("r3_atrasado");
    const { sessao, sub } = await checkoutPago(userId, "basico_mensal"); // pago 1 h antes (relógio da Stripe)
    assert.equal((await apresentar(userId, compraNaLoja(userId, "r3_atrasado", "pro_mensal"))).status, 200);
    await eventosDoPagamento(sub, sessao);
    assert.equal(falso.retrato(sub).cancel_at_period_end, true);
    assert.deepEqual(await revisoes(userId), [{ tipo: "pagamento_stripe_com_loja", assinatura: sub }]);
    const r = await pedir(userId, "pro_mensal");
    assert.equal(r.corpo.error.code, "ASSINATURA_NA_LOJA");
  });

  it("pagamento Stripe com a loja sem resposta: nada cancelado nem revisado; quando a loja responde, encerra e revisa", async () => {
    const userId = await usuario("r3_fora");
    assert.equal((await apresentar(userId, compraNaLoja(userId, "r3_fora", "pro_mensal"))).status, 200);
    loja.consultaFora = true;
    const { sub, sessao } = await checkoutPago(userId, "basico_mensal");
    await eventosDoPagamento(sub, sessao);
    assert.deepEqual(await encerramentos(userId), [{ tipo: "encerrar_por_loja", status: "pendente", substituida: sub, erro: "loja_indisponivel" }]);
    assert.equal(falso.retrato(sub).cancel_at_period_end, false);
    assert.deepEqual(await revisoes(userId), []);

    loja.consultaFora = false;
    await retomar(userId);
    assert.equal(falso.retrato(sub).cancel_at_period_end, true);
    assert.deepEqual(await revisoes(userId), [{ tipo: "pagamento_stripe_com_loja", assinatura: sub }]);
  });

  it("pagamento Stripe de quem tem só compra de loja já encerrada: a Stripe segue, nada cancelado", async () => {
    const userId = await usuario("r3_encerrada");
    const externalId = compraNaLoja(userId, "r3_encerrada", "pro_mensal", { vigente: false, renova: false, expiraEm: new Date(Date.now() - DIA) });
    assert.equal((await apresentar(userId, externalId)).status, 409);
    const { sessao, sub } = await checkoutPago(userId, "basico_mensal");
    await eventosDoPagamento(sub, sessao);
    assert.deepEqual(await encerramentos(userId), [{ tipo: "encerrar_por_loja", status: "descartada", substituida: sub, erro: "loja_nao_vigente" }]);
    assert.equal(falso.retrato(sub).cancel_at_period_end, false);
    assert.equal(await acesso(userId), "BASIC");
  });

  it("eventos do pagamento repetidos: uma operação e um caso", async () => {
    const userId = await usuario("r3_repetido");
    assert.equal((await apresentar(userId, compraNaLoja(userId, "r3_repetido", "pro_mensal"))).status, 200);
    const { sub, sessao } = await checkoutPago(userId, "basico_mensal");
    for (let i = 0; i < 2; i++) await eventosDoPagamento(sub, sessao);
    await Promise.all([1, 2].map(() => entregar("checkout.session.completed", sessao)));
    assert.equal((await encerramentos(userId)).length, 1);
    assert.equal((await revisoes(userId)).length, 1);
    assert.equal(escritas("subscriptions.update"), 1);
  });

  // ── Serialização por pessoa ───────────────────────────────────────────────

  it("o vínculo pelo webhook ESPERA a compra de loja da mesma pessoa que está em andamento", async () => {
    const { userId, sub: a } = await assinanteStripe("serial", "basico_mensal");
    const { sub: b, sessao } = await checkoutPago(userId, "pro_mensal");
    let soltar!: () => void;
    let entrou!: () => void;
    const dentro = new Promise<void>((r) => (entrou = r));
    loja.pausa = new Promise<void>((r) => (soltar = r));
    loja.aoConsultar = entrou;
    try {
      const compra = apresentar(userId, compraNaLoja(userId, "serial", "pro_mensal"));
      await dentro; // a compra está sob a trava da pessoa, consultando a loja
      // Os dois caminhos que vinculam: a primeira fatura e o completed.
      const eventos = Promise.all([primeiraFatura(b), entregar("checkout.session.completed", sessao)]);
      await new Promise((r) => setTimeout(r, 300));
      assert.equal((await linha(userId)).externalId, a, "nenhum evento vincula enquanto a compra de loja não termina");
      loja.pausa = null;
      soltar();
      assert.equal((await compra).status, 200);
      assert.deepEqual(await eventos, [200, 200]);
    } finally {
      loja.pausa = null;
      loja.aoConsultar = null;
      soltar?.();
    }
    assert.equal((await linha(userId)).externalId, b);
    await retomar(userId);
    assert.equal(vaiRenovar(a), false);
    assert.equal(vaiRenovar(b), false);
    assert.deepEqual(await revisoes(userId), [{ tipo: "pagamento_stripe_com_loja", assinatura: b }]);
  });

  it("compra na loja e pagamento Stripe ao mesmo tempo: em qualquer ordem, a Stripe não renova", async () => {
    // Sem a trava, a corrida às vezes passa: várias rodadas para ela aparecer.
    for (let rodada = 0; rodada < 8; rodada++) {
      const userId = await usuario(`concorrente_${rodada}`);
      const { sub, sessao } = await checkoutPago(userId, "basico_mensal");
      const externalId = compraNaLoja(userId, `concorrente_${rodada}`, "pro_mensal");
      const [compra, fatura, concluido] = await Promise.all([
        apresentar(userId, externalId),
        primeiraFatura(sub),
        entregar("checkout.session.completed", sessao),
      ]);
      assert.ok(compra.status === 200 || compra.corpo?.error?.code === "OPERACAO_EM_ANDAMENTO", JSON.stringify(compra));
      if (compra.status !== 200) assert.equal((await apresentar(userId, externalId)).status, 200);
      // Trava ocupada além da espera: a Stripe reenvia o evento.
      if (fatura !== 200) assert.equal(await primeiraFatura(sub), 200);
      if (concluido !== 200) assert.equal(await entregar("checkout.session.completed", sessao), 200);
      await retomar(userId);
      assert.equal(vaiRenovar(sub), false, `rodada ${rodada}: a Stripe encerra no fim do período`);
      assert.equal((await comprasGravadas(userId)).length, 1);
    }
  });

  // ── Acesso ────────────────────────────────────────────────────────────────

  it("acesso: vale o maior plano válido; a compra da loja vale até a data que a loja deu", async () => {
    const { userId } = await assinanteStripe("acesso", "basico_mensal");
    assert.equal(await acesso(userId), "BASIC");
    const externalId = compraNaLoja(userId, "acesso", "pro_mensal");
    assert.equal((await apresentar(userId, externalId)).status, 200);
    assert.equal(await acesso(userId), "PREMIUM");
    await prisma.assinaturaLoja.updateMany({ where: { externalId }, data: { expiraEm: new Date(Date.now() - 1000) } });
    assert.equal(await acesso(userId), "BASIC", "sem renovação confirmada pela loja, volta ao que a Stripe paga");
  });
});
