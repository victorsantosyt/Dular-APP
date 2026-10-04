import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { criarStripeFalso, type StripeFalso } from "./_stripeFalso";

/**
 * Ordem e repetição dos eventos de assinatura Stripe contra Postgres REAL.
 *
 * A Stripe não garante ordem nem entrega única: na sandbox, o `invoice.paid`
 * da compra chegou ANTES do `checkout.session.completed` nas três compras, e
 * cada `invoice.payment_failed` reentregue regravava as datas do corte. Aqui a
 * ordem é controlada à mão pelo `id` e pelo `created` de cada evento, e cada
 * fatura leva o seu id e o fim do período REAL dela. Valem o lock consultivo, a
 * deduplicação em StripeEventoAssinatura e o recálculo a partir de
 * Subscription.stripeBase — os do Postgres, não um simulador. No fim, a
 * atomicidade: erro ou timeout no meio da transação desfaz tudo.
 *
 * Mesmo protocolo das outras suítes de banco: SAFESCORE_DB_URL local;
 * obrigatório no CI (SAFESCORE_DB_REQUIRED=1). Eventos sintéticos assinados
 * pelo SDK com segredo fictício — nenhuma chamada à Stripe. "Sem mudança" é
 * conferido por FOTO da linha, com updatedAt.
 */

const URL_BANCO = process.env.SAFESCORE_DB_URL;
const PULAR = !URL_BANCO
  ? "defina SAFESCORE_DB_URL (Postgres local com as migrations aplicadas)"
  : !/@(localhost|127\.0\.0\.1)[:/]/.test(URL_BANCO)
    ? "SAFESCORE_DB_URL não aponta para localhost — recusado"
    : false;
const EXIGIDO = process.env.SAFESCORE_DB_REQUIRED === "1";
const SEGREDO = "whsec_ficticio_assinatura_ordem_db";

const T0 = 1_790_000_000; // `created` base dos eventos, em segundos
const DIA = 86_400;
const em = (s: number) => new Date(s * 1000);
const fim = (dias: number) => T0 + dias * DIA;

function embaralhar<T>(itens: T[]): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

describe("ordem dos eventos de assinatura Stripe contra Postgres real", { skip: EXIGIDO ? false : PULAR }, () => {
  let prisma: any;
  let post: (req: Request) => Promise<Response>;
  let assinar: (payload: string) => string;
  let validadeProvisoria: (s: number) => Date;
  let limites: { lockTimeoutMs: number; statementTimeoutMs: number; maxWaitMs: number; timeoutMs: number };
  const gatilhos: string[] = [];
  // Trocar o vínculo de `sub_` agenda o cancelamento da anterior na Stripe: a
  // Stripe é SIMULADA (nenhuma rede), com o dono de cada `sub_` tirado dos
  // eventos que o próprio teste envia.
  let falso: StripeFalso;
  const donos = new Map<string, string>();

  const RUN = `t_ass_${Date.now().toString(36)}`;
  let testemunha = "";
  let testemunhaAntes: unknown = null;
  const usuarios: string[] = [];

  async function usuario(sufixo: string) {
    const id = `${RUN}_${sufixo}`;
    await prisma.user.create({ data: { id, nome: `Teste assinatura ${sufixo}`, role: "DIARISTA" } });
    usuarios.push(id);
    return id;
  }

  const sub = (sufixo: string) => `sub_${RUN}_${sufixo}`;
  const evt = (sufixo: string) => `evt_${RUN}_${sufixo}`;

  async function enviar(tipo: string, objeto: Record<string, unknown>, id: string, created: number) {
    const payload = JSON.stringify({
      id,
      object: "event",
      type: tipo,
      api_version: "2026-04-22.dahlia",
      created,
      livemode: false,
      data: { object: objeto },
    });
    const res = await post(
      new Request("http://test/api/webhooks/stripe", { method: "POST", headers: { "stripe-signature": assinar(payload) }, body: payload }),
    );
    return res.status;
  }

  const NIVEL: Record<string, string> = { pro_mensal: "PREMIUM", basico_mensal: "BASIC" };
  const metadados = (userId: string, planId = "pro_mensal") => ({ userId, planId, subscriptionPlan: NIVEL[planId] });

  function concluido(userId: string, assinatura: string, id: string, created: number, planId = "pro_mensal") {
    donos.set(assinatura, userId);
    return enviar(
      "checkout.session.completed",
      {
        id: `cs_${RUN}_${id}`,
        object: "checkout.session",
        mode: "subscription",
        payment_status: "paid",
        client_reference_id: userId,
        subscription: assinatura,
        metadata: metadados(userId, planId),
      },
      evt(id),
      created,
    );
  }

  /** Fatura `faturaId` (padrão: uma por evento) com período até `fimSeg`. */
  function fatura(
    tipo: string,
    assinatura: string,
    id: string,
    created: number,
    fimSeg: number,
    meta: Record<string, string> = {},
    faturaId = `in_${RUN}_${id}`,
    motivo?: string,
  ) {
    if (meta.userId) donos.set(assinatura, meta.userId);
    return enviar(
      tipo,
      {
        id: faturaId,
        billing_reason: motivo,
        object: "invoice",
        metadata: {},
        parent: { type: "subscription_details", quote_details: null, subscription_details: { metadata: meta, subscription: assinatura } },
        lines: {
          object: "list",
          data: [{ id: `il_${RUN}_${id}`, object: "line_item", period: { start: fimSeg - 30 * DIA, end: fimSeg }, subscription: null }],
        },
      },
      evt(id),
      created,
    );
  }
  /** Fatura paga; renovação (`subscription_cycle`) por padrão. */
  const pago = (
    assinatura: string,
    id: string,
    created: number,
    fimSeg: number,
    meta: Record<string, string> = {},
    faturaId?: string,
    motivo = "subscription_cycle",
  ) => fatura("invoice.paid", assinatura, id, created, fimSeg, meta, faturaId, motivo);
  /** PRIMEIRA fatura da assinatura (`subscription_create`): a única que cria vínculo. */
  const primeira = (assinatura: string, id: string, created: number, fimSeg: number, meta: Record<string, string> = {}, faturaId?: string) =>
    pago(assinatura, id, created, fimSeg, meta, faturaId, "subscription_create");
  /** Falha da fatura `faturaId`, com o fim do período REAL dela. */
  const falhou = (assinatura: string, id: string, created: number, fimSeg: number, faturaId?: string) =>
    fatura("invoice.payment_failed", assinatura, id, created, fimSeg, {}, faturaId);
  const cancelado = (assinatura: string, id: string, created: number) =>
    enviar("customer.subscription.deleted", { id: assinatura, object: "subscription", status: "canceled" }, evt(id), created);

  async function foto(userId: string) {
    return prisma.subscription.findUnique({
      where: { userId },
      select: {
        plan: true,
        status: true,
        provider: true,
        externalId: true,
        storeProductId: true,
        startedAt: true,
        expiresAt: true,
        canceledAt: true,
        stripeBase: true,
        updatedAt: true,
      },
    });
  }

  const estado = (l: { status: string; expiresAt: Date | null; canceledAt: Date | null }) => ({
    status: l.status,
    expiresAt: l.expiresAt,
    canceledAt: l.canceledAt,
  });
  const baseJson = (expiresAt: Date) => ({ status: "ACTIVE", expiresAt: expiresAt.toISOString(), canceledAt: null });
  const guardados = (eventId: string) => prisma.stripeEventoAssinatura.count({ where: { eventId } });

  before(async () => {
    if (PULAR) throw new Error(`SAFESCORE_DB_REQUIRED=1, mas ${PULAR}`);
    process.env.DATABASE_URL = URL_BANCO;
    process.env.STRIPE_WEBHOOK_SECRET = SEGREDO;
    process.env.STRIPE_SECRET_KEY ??= "sk_test_ficticio_sem_uso_de_rede";
    ({ prisma } = await import("../../src/lib/prisma"));
    const { stripe, PLANS, validadeDoPlano } = await import("../../src/lib/stripe");
    assinar = (payload) => stripe.webhooks.generateTestHeaderString({ payload, secret: SEGREDO });
    validadeProvisoria = (s) => validadeDoPlano(PLANS.pro_mensal, em(s));
    post = (await import("../../src/app/api/webhooks/stripe/route")).POST;
    ({ limitesTransacaoStripe: limites } = await import("../../src/lib/assinatura"));
    falso = criarStripeFalso();
    falso.estado.externas = (id) => (donos.has(id) ? { userId: donos.get(id)!, paga: true } : null);
    falso.instalar(stripe);

    // Assinatura Stripe de outro usuário, com base e um evento próprio, gravada
    // antes de tudo: não pode mudar.
    testemunha = await usuario("testemunha");
    await prisma.subscription.create({
      data: {
        userId: testemunha,
        plan: "PREMIUM",
        status: "ACTIVE",
        provider: "STRIPE",
        externalId: sub("testemunha"),
        startedAt: em(T0),
        expiresAt: em(fim(30)),
        stripeBase: baseJson(em(fim(1))),
      },
    });
    await prisma.stripeEventoAssinatura.create({
      data: { eventId: evt("testemunha"), externalId: sub("testemunha"), tipo: "invoice.paid", criadoEm: em(T0), fimPeriodo: em(fim(30)) },
    });
    testemunhaAntes = await fotoDaTestemunha();
  });

  async function fotoDaTestemunha() {
    return {
      linha: await foto(testemunha),
      eventos: await prisma.stripeEventoAssinatura.findMany({ where: { externalId: sub("testemunha") } }),
    };
  }

  after(async () => {
    falso?.restaurar();
    if (!prisma) return;
    for (const nome of gatilhos) await removerGatilho(nome);
    await prisma.stripeOperacao.deleteMany({ where: { userId: { in: usuarios } } });
    // Só as linhas deste RUN: todo evento enviado aqui tem id `evt_<RUN>_…`.
    await prisma.stripeEventoAssinatura.deleteMany({ where: { eventId: { startsWith: `evt_${RUN}_` } } });
    await prisma.subscription.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.user.deleteMany({ where: { id: { in: usuarios } } });
    await prisma.$disconnect();
  });

  // ── Cenários da v1, nos campos novos ──────────────────────────────────────

  it("invoice.paid ANTES do completed: a linha nasce com o fim do período; o completed depois não escreve", async () => {
    const u = await usuario("paid_antes");
    const s = sub("paid_antes");
    assert.equal(await primeira(s, "pa_p1", T0, fim(30), metadados(u)), 200);
    const criada = await foto(u);
    assert.ok(criada, "o invoice.paid cria a linha pelos metadados da assinatura");
    assert.equal(criada.plan, "PREMIUM");
    assert.equal(criada.status, "ACTIVE");
    assert.equal(criada.provider, "STRIPE");
    assert.equal(criada.externalId, s);
    assert.equal(criada.storeProductId, null);
    assert.equal(criada.canceledAt, null);
    assert.deepEqual(criada.startedAt, em(T0));
    assert.deepEqual(criada.expiresAt, em(fim(30)), "fim do período exato da fatura");
    assert.deepEqual(criada.stripeBase, baseJson(validadeProvisoria(T0)));

    assert.equal(await concluido(u, s, "pa_c1", T0 + 1), 200);
    assert.deepEqual(await foto(u), criada, "completed da mesma assinatura: foto idêntica");
  });

  it("completed ANTES do invoice.paid de created ANTERIOR (como na Stripe): o período é aplicado", async () => {
    const u = await usuario("completed_antes");
    const s = sub("completed_antes");
    assert.equal(await concluido(u, s, "ca_c1", T0 + 1), 200);
    const provisoria = await foto(u);
    assert.deepEqual(provisoria.expiresAt, validadeProvisoria(T0 + 1), "validade provisória do completed");
    assert.deepEqual(provisoria.stripeBase, baseJson(validadeProvisoria(T0 + 1)));

    assert.equal(await primeira(s, "ca_p1", T0, fim(30), metadados(u)), 200);
    const paga = await foto(u);
    assert.equal(paga.status, "ACTIVE");
    assert.deepEqual(paga.expiresAt, em(fim(30)));
    assert.deepEqual(paga.startedAt, em(T0 + 1), "o vínculo continua o do completed");
    assert.deepEqual(paga.stripeBase, provisoria.stripeBase, "eventos não mudam a base");
  });

  it("reentrega de cada evento (completed, invoice.paid, invoice.payment_failed, deleted): foto idêntica", async () => {
    const u = await usuario("reentrega");
    const s = sub("reentrega");
    await concluido(u, s, "re_c1", T0 + 1);
    await primeira(s, "re_p1", T0, fim(30), metadados(u));
    let antes = await foto(u);
    assert.equal(await concluido(u, s, "re_c1", T0 + 1), 200);
    assert.deepEqual(await foto(u), antes, "completed reentregue");
    assert.equal(await primeira(s, "re_p1", T0, fim(30), metadados(u)), 200);
    assert.deepEqual(await foto(u), antes, "invoice.paid reentregue");

    assert.equal(await falhou(s, "re_f1", fim(30), fim(60)), 200);
    antes = await foto(u);
    assert.equal(antes.status, "EXPIRED");
    assert.deepEqual(antes.expiresAt, em(fim(30)));
    assert.deepEqual(antes.canceledAt, em(fim(30)));
    assert.equal(await falhou(s, "re_f1", fim(30), fim(60)), 200);
    assert.deepEqual(await foto(u), antes, "invoice.payment_failed reentregue");

    assert.equal(await cancelado(s, "re_d1", fim(31)), 200);
    antes = await foto(u);
    assert.equal(antes.status, "CANCELED");
    assert.deepEqual(antes.canceledAt, em(fim(31)));
    assert.equal(await cancelado(s, "re_d1", fim(31)), 200);
    assert.deepEqual(await foto(u), antes, "customer.subscription.deleted reentregue");

    // Duplicata de um evento ANTIGO, entregue lá no fim: também não escreve.
    assert.equal(await primeira(s, "re_p1", T0, fim(30), metadados(u)), 200);
    assert.deepEqual(await foto(u), antes, "duplicata de evento antigo");
    for (const id of ["re_p1", "re_f1", "re_d1"]) assert.equal(await guardados(evt(id)), 1, `${id} guardado uma vez`);
  });

  it("falha antiga chegando depois de um pagamento mais recente: segue ACTIVE", async () => {
    const u = await usuario("falha_antiga");
    const s = sub("falha_antiga");
    await concluido(u, s, "fa_c1", T0 + 1);
    await primeira(s, "fa_p1", T0, fim(30), metadados(u));
    // A renovação (período até fim(60)) falhou em fim(30) e foi paga na nova
    // tentativa em fim(32); a notificação da falha chega por último.
    const renovacao = `in_${RUN}_fa_renovacao`;
    assert.equal(await pago(s, "fa_p2", fim(32), fim(60), {}, renovacao), 200);
    const antes = await foto(u);
    assert.equal(await falhou(s, "fa_f1", fim(30), fim(60), renovacao), 200);
    const depois = await foto(u);
    assert.deepEqual(depois, antes, "período quitado: a falha vem antes do pagamento, nada muda");
    assert.equal(depois.status, "ACTIVE");
    assert.deepEqual(depois.expiresAt, em(fim(60)));
  });

  it("falha antiga chegando depois da exclusão: expiresAt = corte", async () => {
    const u = await usuario("falha_depois_exclusao");
    const s = sub("falha_depois_exclusao");
    await concluido(u, s, "fe_c1", T0 + 1);
    await primeira(s, "fe_p1", T0, fim(60), metadados(u));
    assert.equal(await cancelado(s, "fe_d1", fim(40)), 200);
    assert.deepEqual((await foto(u)).expiresAt, em(fim(60)), "cancelada: vale até o fim pago");
    // Fatura avulsa do MESMO período, nunca paga: o período fica em aberto.
    assert.equal(await falhou(s, "fe_f1", fim(35), fim(60), `in_${RUN}_fe_avulsa`), 200);
    const l = await foto(u);
    assert.equal(l.status, "CANCELED");
    assert.deepEqual(l.expiresAt, em(fim(35)), "o corte entra antes da exclusão");
    assert.deepEqual(l.canceledAt, em(fim(40)));
  });

  it("falha DISTINTA com a linha já EXPIRED: expiresAt/canceledAt da primeira falha preservados", async () => {
    const u = await usuario("falha_distinta");
    const s = sub("falha_distinta");
    await concluido(u, s, "fd_c1", T0 + 1);
    await primeira(s, "fd_p1", T0, fim(30), metadados(u));
    const renovacao = `in_${RUN}_fd_renovacao`;
    await falhou(s, "fd_f1", fim(30), fim(60), renovacao);
    const antes = await foto(u);
    assert.equal(antes.status, "EXPIRED");
    assert.equal(await falhou(s, "fd_f2", fim(33), fim(60), renovacao), 200);
    assert.deepEqual(await foto(u), antes, "nova tentativa que falha não empurra o corte");
  });

  it("ciclo: renovação, falha, nova tentativa paga, cancelamento; completed atrasado não reativa", async () => {
    const u = await usuario("ciclo");
    const s = sub("ciclo");
    await concluido(u, s, "ci_c1", T0 + 1);
    await primeira(s, "ci_p1", T0, fim(30), metadados(u));

    assert.equal(await pago(s, "ci_p2", fim(30), fim(60)), 200);
    assert.deepEqual((await foto(u)).expiresAt, em(fim(60)), "renovação paga: novo período");

    const terceira = `in_${RUN}_ci_terceira`;
    assert.equal(await falhou(s, "ci_f3", fim(60), fim(90), terceira), 200);
    let l = await foto(u);
    assert.equal(l.status, "EXPIRED");
    assert.deepEqual(l.expiresAt, em(fim(60)));
    assert.deepEqual(l.canceledAt, em(fim(60)));

    assert.equal(await pago(s, "ci_p3", fim(62), fim(90), {}, terceira), 200);
    l = await foto(u);
    assert.equal(l.status, "ACTIVE", "nova tentativa paga reativa");
    assert.equal(l.canceledAt, null);
    assert.deepEqual(l.expiresAt, em(fim(90)));

    assert.equal(await cancelado(s, "ci_d1", fim(70)), 200);
    l = await foto(u);
    assert.equal(l.status, "CANCELED");
    assert.deepEqual(l.canceledAt, em(fim(70)));
    assert.deepEqual(l.expiresAt, em(fim(90)), "cancelou: vale até o fim do que pagou");

    assert.equal(await concluido(u, s, "ci_c1", T0 + 1), 200);
    assert.equal(await concluido(u, s, "ci_c1_tardio", fim(71)), 200);
    assert.deepEqual(await foto(u), l, "completed da mesma assinatura não reativa");
  });

  it("completed de compra ANTIGA (outra sub, created anterior) depois de uma compra nova: ignorado", async () => {
    const u = await usuario("compra_antiga");
    await concluido(u, sub("compra_nova"), "an_c_nova", T0 + 100);
    await primeira(sub("compra_nova"), "an_p_nova", T0 + 99, fim(30), metadados(u));
    const antes = await foto(u);
    assert.equal(await concluido(u, sub("compra_velha"), "an_c_velha", T0 + 50), 200);
    assert.deepEqual(await foto(u), antes, "compra antiga não toma o lugar da nova");

    // Controle positivo: compra MAIS NOVA troca o vínculo e leva os eventos dela.
    assert.equal(await pago(sub("compra_mais_nova"), "an_p_mais_nova", T0 + 199, fim(400)), 200);
    assert.deepEqual(await foto(u), antes, "sem metadados: o pagamento fica guardado");
    assert.equal(await concluido(u, sub("compra_mais_nova"), "an_c_mais_nova", T0 + 200), 200);
    const trocada = await foto(u);
    assert.equal(trocada.externalId, sub("compra_mais_nova"));
    assert.deepEqual(trocada.startedAt, em(T0 + 200));
    assert.equal(trocada.status, "ACTIVE");
    assert.deepEqual(trocada.expiresAt, em(fim(400)), "o pagamento guardado da sub nova entra na troca");
    assert.deepEqual(trocada.stripeBase, baseJson(validadeProvisoria(T0 + 200)));
  });

  it("invoice.paid e completed da mesma compra SIMULTÂNEOS, usuário sem linha: todos 200 e o período da fatura", async () => {
    for (let rodada = 0; rodada < 6; rodada++) {
      const u = await usuario(`simultaneo_${rodada}`);
      const s = sub(`simultaneo_${rodada}`);
      const envios = embaralhar([
        () => primeira(s, `si_${rodada}_p1`, T0, fim(30), metadados(u)),
        () => concluido(u, s, `si_${rodada}_c1`, T0 + 1),
        () => primeira(s, `si_${rodada}_p1`, T0, fim(30), metadados(u)),
        () => concluido(u, s, `si_${rodada}_c1`, T0 + 1),
      ]);
      const status = await Promise.all(envios.map((f) => f()));
      assert.deepEqual(status, [200, 200, 200, 200], `rodada ${rodada}: ${JSON.stringify(status)}`);
      const l = await foto(u);
      assert.equal(l.status, "ACTIVE", `rodada ${rodada}`);
      assert.equal(l.externalId, s, `rodada ${rodada}`);
      assert.deepEqual(l.expiresAt, em(fim(30)), `rodada ${rodada}: período da fatura`);
      assert.equal(await guardados(evt(`si_${rodada}_p1`)), 1, `rodada ${rodada}`);
    }
  });

  it("legado sem metadados, invoice.paid ANTES do completed: o completed aplica o período exato, sem reenvio", async () => {
    const u = await usuario("legado");
    const s = sub("legado");
    assert.equal(await pago(s, "le_p1", T0, fim(30)), 200);
    assert.equal(await foto(u), null, "sem metadados não há a quem vincular");
    assert.equal(await prisma.subscription.count({ where: { externalId: s } }), 0);
    assert.equal(await guardados(evt("le_p1")), 1, "o evento fica guardado");

    assert.equal(await concluido(u, s, "le_c1", T0 + 1), 200);
    const l = await foto(u);
    assert.equal(l.status, "ACTIVE");
    assert.deepEqual(l.expiresAt, em(fim(30)), "fim do período exato, sem reenvio e sem próxima fatura");
    assert.deepEqual(l.stripeBase, baseJson(validadeProvisoria(T0 + 1)));
  });

  it("invoice.paid com usuário dos metadados inexistente: nenhuma assinatura, evento guardado, 200", async () => {
    const fantasma = `${RUN}_nao_existe`;
    assert.equal(await primeira(sub("fantasma"), "fa_p_fantasma", T0, fim(30), metadados(fantasma)), 200);
    assert.equal(await prisma.subscription.count({ where: { externalId: sub("fantasma") } }), 0);
    assert.equal(await guardados(evt("fa_p_fantasma")), 1);
  });

  // ── Pares no MESMO `created`: a ordem de chegada não muda o estado ────────

  const T = fim(30); // renovação: os dois eventos de cada par no mesmo segundo (salvo onde dito)
  type Lado = [string, (s: string) => Promise<number>];
  // A fatura de cada lado leva a sub no id: `in_<sub>_<rótulo>`.
  const f = (s: string, rotulo: string) => `in_${s}_${rotulo}`;
  const pares: Array<{ nome: string; a: Lado; b: Lado; esperado: Record<string, unknown> }> = [
    {
      nome: "falha e exclusão",
      a: ["F", (s) => falhou(s, `${s}_F`, T, fim(60), f(s, "renovacao"))],
      b: ["D", (s) => cancelado(s, `${s}_D`, T)],
      esperado: { status: "CANCELED", expiresAt: em(T), canceledAt: em(T) },
    },
    {
      nome: "paga e exclusão",
      a: ["P", (s) => pago(s, `${s}_P`, T, fim(60), {}, f(s, "renovacao"))],
      b: ["D", (s) => cancelado(s, `${s}_D`, T)],
      esperado: { status: "CANCELED", expiresAt: em(fim(60)), canceledAt: em(T) },
    },
    {
      nome: "duas faturas pagas de períodos diferentes",
      a: ["P1", (s) => pago(s, `${s}_P1`, T, fim(60), {}, f(s, "a"))],
      b: ["P2", (s) => pago(s, `${s}_P2`, T, fim(61), {}, f(s, "b"))],
      esperado: { status: "ACTIVE", expiresAt: em(fim(61)), canceledAt: null },
    },
    {
      nome: "duas falhas de faturas diferentes do mesmo período",
      a: ["F1", (s) => falhou(s, `${s}_F1`, T, fim(60), f(s, "a"))],
      b: ["F2", (s) => falhou(s, `${s}_F2`, T, fim(60), f(s, "b"))],
      esperado: { status: "EXPIRED", expiresAt: em(T), canceledAt: em(T) },
    },
    {
      nome: "duas faturas do mesmo período, uma paga e a outra só falhou",
      a: ["P", (s) => pago(s, `${s}_P`, T, fim(60), {}, f(s, "a"))],
      b: ["F", (s) => falhou(s, `${s}_F`, T, fim(60), f(s, "b"))],
      esperado: { status: "EXPIRED", expiresAt: em(T), canceledAt: em(T) },
    },
    {
      nome: "falha da fatura antiga e paga da mais nova",
      a: ["F", (s) => falhou(s, `${s}_F`, T, fim(30), f(s, "antiga"))],
      b: ["P", (s) => pago(s, `${s}_P`, T, fim(60), {}, f(s, "nova"))],
      esperado: { status: "ACTIVE", expiresAt: em(fim(60)), canceledAt: null },
    },
    {
      nome: "paga da fatura antiga e falha do período novo",
      a: ["P", (s) => pago(s, `${s}_P`, T, fim(30), {}, f(s, "antiga"))],
      b: ["F", (s) => falhou(s, `${s}_F`, T, fim(60), f(s, "nova"))],
      esperado: { status: "EXPIRED", expiresAt: em(T), canceledAt: em(T) },
    },
    {
      nome: "mesma fatura falhou e foi paga",
      a: ["F", (s) => falhou(s, `${s}_F`, T, fim(60), f(s, "renovacao"))],
      b: ["P", (s) => pago(s, `${s}_P`, T, fim(60), {}, f(s, "renovacao"))],
      esperado: { status: "ACTIVE", expiresAt: em(fim(60)), canceledAt: null },
    },
    {
      nome: "falha de período antigo em segundo POSTERIOR à paga do período novo",
      a: ["P", (s) => pago(s, `${s}_P`, T, fim(60), {}, f(s, "nova"))],
      b: ["F", (s) => falhou(s, `${s}_F`, T + 3600, fim(30), f(s, "antiga"))],
      esperado: { status: "ACTIVE", expiresAt: em(fim(60)), canceledAt: null },
    },
    {
      nome: "fatura avulsa paga com período anterior ao vigente",
      a: ["P", (s) => pago(s, `${s}_P`, T, fim(60), {}, f(s, "vigente"))],
      b: ["A", (s) => pago(s, `${s}_A`, T + 3600, fim(45), {}, f(s, "avulsa"))],
      esperado: { status: "ACTIVE", expiresAt: em(fim(60)), canceledAt: null },
    },
  ];

  /** Usuário com vínculo e o primeiro período pago, antes do par. */
  async function preparar(sufixo: string) {
    const u = await usuario(sufixo);
    const s = sub(sufixo);
    assert.equal(await concluido(u, s, `${sufixo}_c`, T0 + 1), 200);
    assert.equal(await primeira(s, `${sufixo}_p0`, T0, fim(30), metadados(u)), 200);
    return { u, s };
  }

  /**
   * A→B→A→B, B→A→B→A e 5 rodadas concorrentes (embaralhadas e repetidas):
   * estado final igual ao esperado em todas; reentrega não escreve (foto com
   * updatedAt); cada evento guardado 1×. O id de cada evento leva a sub
   * (`evt_<RUN>_sub_<RUN>_…`): cai na limpeza do RUN.
   */
  async function verificarPar(
    prefixo: string,
    prepararPar: (sufixo: string) => Promise<{ u: string; s: string }>,
    a: Lado,
    b: Lado,
    esperado: Record<string, unknown>,
    conferirFoto: (f: any) => void = () => {},
  ) {
    const finais: Record<string, unknown>[] = [];

    for (const [rotulo, ordem] of [["ABAB", [a, b, a, b]], ["BABA", [b, a, b, a]]] as const) {
      const { u, s } = await prepararPar(`${prefixo}_${rotulo}`);
      const fotos = [];
      for (const [, envio] of ordem) {
        assert.equal(await envio(s), 200, rotulo);
        fotos.push(await foto(u));
      }
      assert.deepEqual(fotos[2], fotos[1], `${rotulo}: 3ª entrega (reentrega) não escreve`);
      assert.deepEqual(fotos[3], fotos[1], `${rotulo}: 4ª entrega (reentrega) não escreve`);
      assert.deepEqual(estado(fotos[3]), esperado, `${rotulo}: estado esperado`);
      conferirFoto(fotos[3]);
      finais.push(estado(fotos[3]));
    }

    for (let rodada = 0; rodada < 5; rodada++) {
      const { u, s } = await prepararPar(`${prefixo}_conc${rodada}`);
      const entregas = embaralhar([a, b, a, b, a, b]);
      const ordem = entregas.map(([r]) => r).join(",");
      const status = await Promise.all(entregas.map(([, envio]) => envio(s)));
      assert.deepEqual(status, [200, 200, 200, 200, 200, 200], `rodada ${rodada} (${ordem}): ${JSON.stringify(status)}`);
      const depois = await foto(u);
      assert.deepEqual(estado(depois), esperado, `rodada ${rodada} (${ordem}): estado esperado`);
      conferirFoto(depois);
      finais.push(estado(depois));

      // Com os dois já guardados, novas reentregas não escrevem.
      assert.equal(await a[1](s), 200);
      assert.equal(await b[1](s), 200);
      assert.deepEqual(await foto(u), depois, `rodada ${rodada}: reentrega depois da concorrência`);
      for (const [r] of [a, b]) assert.equal(await guardados(evt(`${s}_${r}`)), 1, `rodada ${rodada}: ${r} guardado uma vez`);
    }

    for (const f of finais) assert.deepEqual(f, finais[0], "o mesmo estado em todas as ordens");
  }

  for (const [indice, { nome, a, b, esperado }] of pares.entries()) {
    it(`par (${nome}): A→B→A→B, B→A→B→A e concorrente terminam iguais; reentrega não escreve`, async () => {
      await verificarPar(`par${indice}`, preparar, a, b, esperado);
    });
  }

  // ── B1: renovação de assinatura substituída não recupera o vínculo ──────
  //
  // Só a PRIMEIRA fatura (`subscription_create`) cria ou troca vínculo; a
  // renovação de uma assinatura substituída continua chegando (com os mesmos
  // metadados) e o `created` dela é posterior ao início da assinatura nova.

  const TN = T0 + 10 * DIA; // início da assinatura nova
  const PLANO_NOVO = { plan: "PREMIUM", status: "ACTIVE", expiresAt: em(fim(40)), canceledAt: null, startedAt: em(TN) };
  const vinculoDe = (l: any) => ({ plan: l.plan, status: l.status, expiresAt: l.expiresAt, canceledAt: l.canceledAt, startedAt: l.startedAt });

  /** Comprou a antiga (BASIC): completed + primeira fatura. */
  async function compraAntiga(sufixo: string) {
    const u = await usuario(sufixo);
    const antiga = sub(`${sufixo}_antiga`);
    const nova = sub(`${sufixo}_nova`);
    assert.equal(await concluido(u, antiga, `${sufixo}_ca`, T0 + 1, "basico_mensal"), 200);
    assert.equal(await primeira(antiga, `${sufixo}_pa`, T0, fim(30), metadados(u, "basico_mensal")), 200);
    return { u, antiga, nova };
  }
  // Completed e primeira fatura da nova no MESMO segundo: o startedAt não depende de quem chega antes.
  const completedNova = (u: string, nova: string, sufixo: string) => concluido(u, nova, `${sufixo}_cn`, TN);
  const primeiraNova = (u: string, nova: string, sufixo: string) => primeira(nova, `${sufixo}_pn`, TN, fim(40), metadados(u));
  // Renovação da antiga, com os metadados dela e created POSTERIOR ao início da nova.
  const renovacaoAntiga = (u: string, antiga: string, sufixo: string) =>
    pago(antiga, `${sufixo}_ra`, fim(30), fim(60), metadados(u, "basico_mensal"));
  const segundaRenovacaoAntiga = (u: string, antiga: string, sufixo: string) =>
    pago(antiga, `${sufixo}_ra2`, fim(60), fim(90), metadados(u, "basico_mensal"));

  it("B1: renovação paga da assinatura substituída (created depois da troca): nada muda; reentrega idem", async () => {
    const { u, antiga, nova } = await compraAntiga("b1");
    assert.equal(await completedNova(u, nova, "b1"), 200);
    assert.equal(await primeiraNova(u, nova, "b1"), 200);
    const antes = await foto(u);
    assert.equal(antes.externalId, nova);
    assert.deepEqual(vinculoDe(antes), PLANO_NOVO);
    for (let i = 0; i < 2; i++) {
      assert.equal(await renovacaoAntiga(u, antiga, "b1"), 200);
      assert.deepEqual(await foto(u), antes, `entrega ${i + 1}: plano, vínculo, validade e updatedAt intactos`);
    }
    assert.equal(await guardados(evt("b1_ra")), 1, "o evento fica guardado (histórico)");
    // Trocar o vínculo não basta: a substituída deixa de renovar na Stripe (fim do período, sem estorno).
    assert.equal(falso.retrato(antiga).cancel_at_period_end, true);
    assert.equal(falso.retrato(nova).cancel_at_period_end, false);
    const ops = await prisma.stripeOperacao.findMany({ where: { userId: u }, select: { tipo: true, status: true, externalId: true, substituida: true } });
    assert.deepEqual(ops, [{ tipo: "cancelar_substituida", status: "concluida", externalId: nova, substituida: antiga }]);
  });

  it("B1: ordem inversa — renovação da antiga ANTES do completed da nova: termina na nova PREMIUM", async () => {
    const { u, antiga, nova } = await compraAntiga("b1inv");
    assert.equal(await renovacaoAntiga(u, antiga, "b1inv"), 200);
    const naAntiga = await foto(u);
    assert.equal(naAntiga.externalId, antiga);
    assert.deepEqual(naAntiga.expiresAt, em(fim(60)), "antes da troca, a renovação vale para a antiga");
    assert.equal(await completedNova(u, nova, "b1inv"), 200);
    assert.equal(await primeiraNova(u, nova, "b1inv"), 200);
    const final = await foto(u);
    assert.equal(final.externalId, nova);
    assert.deepEqual(vinculoDe(final), PLANO_NOVO);
    assert.equal(await renovacaoAntiga(u, antiga, "b1inv"), 200);
    assert.deepEqual(await foto(u), final, "reentrega da renovação depois da troca: nada");
  });

  it("B1: concorrente — duas renovações da antiga × completed e 1ª fatura da nova (6 rodadas): sempre a nova PREMIUM", async () => {
    for (let rodada = 0; rodada < 6; rodada++) {
      const sufixo = `b1c${rodada}`;
      const { u, antiga, nova } = await compraAntiga(sufixo);
      // A antiga e a nova têm locks diferentes: as renovações correm em paralelo à troca.
      const lados: Array<[string, () => Promise<number>]> = [
        ["R1", () => renovacaoAntiga(u, antiga, sufixo)],
        ["R2", () => segundaRenovacaoAntiga(u, antiga, sufixo)],
        ["C", () => completedNova(u, nova, sufixo)],
        ["P", () => primeiraNova(u, nova, sufixo)],
      ];
      const entregas = embaralhar([...lados, ...lados]);
      const ordem = entregas.map(([r]) => r).join(",");
      const status = await Promise.all(entregas.map(([, envio]) => envio()));
      assert.deepEqual(status, entregas.map(() => 200), `rodada ${rodada} (${ordem})`);
      const final = await foto(u);
      assert.equal(final.externalId, nova, `rodada ${rodada} (${ordem})`);
      assert.deepEqual(vinculoDe(final), PLANO_NOVO, `rodada ${rodada} (${ordem})`);
      for (const [, envio] of lados) assert.equal(await envio(), 200);
      assert.deepEqual(await foto(u), final, `rodada ${rodada}: reentrega de tudo não escreve`);
    }
  });

  it("B1: a primeira fatura (subscription_create) ANTES do checkout continua criando o vínculo; renovação, não", async () => {
    const u = await usuario("b1_primeira");
    const s = sub("b1_primeira");
    assert.equal(await pago(s, "b1p_r", T0, fim(30), metadados(u)), 200, "fatura marcada como renovação");
    assert.equal(await foto(u), null, "renovação não cria vínculo");
    assert.equal(await primeira(s, "b1p_p", T0, fim(30), metadados(u)), 200);
    const l = await foto(u);
    assert.equal(l.externalId, s);
    assert.deepEqual(vinculoDe(l), { plan: "PREMIUM", status: "ACTIVE", expiresAt: em(fim(30)), canceledAt: null, startedAt: em(T0) });
  });

  it("B1: renovação de assinatura SEM linha e sem vínculo nenhum do usuário: não cria", async () => {
    const u = await usuario("b1_sem_linha");
    const s = sub("b1_sem_linha");
    for (let i = 0; i < 2; i++) assert.equal(await pago(s, "b1s_r", fim(30), fim(60), metadados(u)), 200);
    assert.equal(await foto(u), null);
    assert.equal(await prisma.subscription.count({ where: { externalId: s } }), 0);
    assert.equal(await guardados(evt("b1s_r")), 1);
  });

  // ── B2: linha legada (stripeBase nulo, anterior à mudança) ─────────────
  //
  // O estado legado já reflete as faturas até o expiresAt dele. O primeiro
  // evento grava a base (origem legado) numa escrita só; fatura até a fronteira
  // é ignorada; depois dela, regra normal; exclusão sempre.

  const LEG = fim(50); // validade legada = período reconhecido
  type EstadoLegado = { status: string; expiresAt: Date | null; canceledAt: Date | null };
  const ESTADO_LEGADO: EstadoLegado = { status: "ACTIVE", expiresAt: em(LEG), canceledAt: null };
  const CORTE = fim(40);
  const LEGADO_EXPIRADO: EstadoLegado = { status: "EXPIRED", expiresAt: em(CORTE), canceledAt: em(CORTE) };

  async function linhaLegada(sufixo: string, estadoLegado: EstadoLegado = ESTADO_LEGADO) {
    const u = await usuario(sufixo);
    const s = sub(sufixo);
    await prisma.subscription.create({
      data: { userId: u, plan: "BASIC", provider: "STRIPE", externalId: s, startedAt: em(T0), ...estadoLegado },
    });
    return { u, s };
  }
  const baseLegada = (l: EstadoLegado) => ({
    status: l.status,
    expiresAt: l.expiresAt?.toISOString() ?? null,
    canceledAt: l.canceledAt?.toISOString() ?? null,
    origem: "legado",
    periodoReconhecido: l.expiresAt?.toISOString() ?? null,
  });

  /** Primeiro evento numa linha legada: estado esperado, base legada em UMA escrita; reentrega sem escrita. */
  async function primeiroEventoLegado(u: string, envio: () => Promise<number>, esperado: Record<string, unknown>) {
    const f0 = await foto(u);
    assert.equal(f0.stripeBase, null);
    assert.equal(await envio(), 200);
    const f1 = await foto(u);
    assert.deepEqual(estado(f1), esperado);
    assert.deepEqual(f1.stripeBase, baseLegada(f0), "base legada: o estado anterior, com a fronteira");
    assert.notDeepEqual(f1.updatedAt, f0.updatedAt, "a inicialização da base é UMA escrita");
    assert.deepEqual([f1.plan, f1.externalId, f1.startedAt], [f0.plan, f0.externalId, f0.startedAt], "vínculo intacto");
    assert.equal(await envio(), 200);
    assert.deepEqual(await foto(u), f1, "reentrega: nenhuma escrita");
    return f1;
  }

  it("B2: legado + paga histórica: validade mantida, base legada em uma escrita; reentrega e outra histórica sem escrita", async () => {
    const { u, s } = await linhaLegada("b2_hist");
    const f1 = await primeiroEventoLegado(u, () => pago(s, "b2h_p", T0 - 20 * DIA, fim(20)), estado(ESTADO_LEGADO));
    assert.equal(await falhou(s, "b2h_f", fim(15), fim(20)), 200);
    assert.deepEqual(await foto(u), f1, "outra fatura histórica: sem escrita");
  });

  it("B2: legado + falha de período NOVO: corta", async () => {
    const { u, s } = await linhaLegada("b2_falha_nova");
    await primeiroEventoLegado(u, () => falhou(s, "b2fn_f", LEG, fim(80)), { status: "EXPIRED", expiresAt: em(LEG), canceledAt: em(LEG) });
  });

  it("B2: legado + falha histórica: nada além da base", async () => {
    const { u, s } = await linhaLegada("b2_falha_hist");
    await primeiroEventoLegado(u, () => falhou(s, "b2fh_f", fim(20), fim(20)), estado(ESTADO_LEGADO));
  });

  it("B2: legado + exclusão: CANCELED com a validade legada mantida", async () => {
    const { u, s } = await linhaLegada("b2_exclusao");
    await primeiroEventoLegado(u, () => cancelado(s, "b2e_d", fim(45)), { status: "CANCELED", expiresAt: em(LEG), canceledAt: em(fim(45)) });
  });

  it("B2: legado + paga de período novo: estende", async () => {
    const { u, s } = await linhaLegada("b2_paga_nova");
    await primeiroEventoLegado(u, () => pago(s, "b2pn_p", LEG, fim(80)), { status: "ACTIVE", expiresAt: em(fim(80)), canceledAt: null });
  });

  it("B2: legado EXPIRED + paga de período posterior ao corte: reativa", async () => {
    const { u, s } = await linhaLegada("b2_reativa", LEGADO_EXPIRADO);
    await primeiroEventoLegado(u, () => pago(s, "b2r_p", fim(42), fim(70)), { status: "ACTIVE", expiresAt: em(fim(70)), canceledAt: null });
  });

  it("B2: legado EXPIRED + paga histórica: nada além da base", async () => {
    const { u, s } = await linhaLegada("b2_expirado_hist", LEGADO_EXPIRADO);
    await primeiroEventoLegado(u, () => pago(s, "b2eh_p", fim(42), fim(30)), estado(LEGADO_EXPIRADO));
  });

  const paresLegado: Array<{ nome: string; a: Lado; b: Lado; esperado: Record<string, unknown> }> = [
    {
      nome: "paga histórica × paga nova",
      a: ["H", (s) => pago(s, `${s}_H`, T0, fim(20), {}, f(s, "historica"))],
      b: ["N", (s) => pago(s, `${s}_N`, LEG, fim(80), {}, f(s, "nova"))],
      esperado: { status: "ACTIVE", expiresAt: em(fim(80)), canceledAt: null },
    },
    {
      nome: "paga histórica × falha do período novo",
      a: ["H", (s) => pago(s, `${s}_H`, T0, fim(20), {}, f(s, "historica"))],
      b: ["F", (s) => falhou(s, `${s}_F`, LEG, fim(80), f(s, "nova"))],
      esperado: { status: "EXPIRED", expiresAt: em(LEG), canceledAt: em(LEG) },
    },
    {
      nome: "falha histórica × paga nova",
      a: ["H", (s) => falhou(s, `${s}_H`, fim(20), fim(20), f(s, "historica"))],
      b: ["N", (s) => pago(s, `${s}_N`, LEG, fim(80), {}, f(s, "nova"))],
      esperado: { status: "ACTIVE", expiresAt: em(fim(80)), canceledAt: null },
    },
  ];
  for (const [indice, { nome, a, b, esperado }] of paresLegado.entries()) {
    it(`B2 par legado (${nome}): A→B→A→B, B→A→B→A e concorrente terminam iguais; reentrega não escreve`, async () => {
      await verificarPar(`leg${indice}`, (sufixo) => linhaLegada(sufixo), a, b, esperado, (l) =>
        assert.deepEqual(l.stripeBase, baseLegada(ESTADO_LEGADO), "base legada gravada uma vez, com o estado ANTERIOR"),
      );
    });
  }

  // ── Atomicidade: erro ou timeout no meio desfaz tudo ─────────────────────
  //
  // Limites curtos só nestes cenários, para a suíte continuar rápida: o lock
  // preso é cortado pelo lock_timeout do Postgres (300 ms), bem antes do
  // timeout do Prisma (3 s).

  const CURTOS = { lockTimeoutMs: 300, statementTimeoutMs: 1_000, maxWaitMs: 2_000, timeoutMs: 3_000 };
  async function comLimitesCurtos<R>(fn: () => Promise<R>): Promise<R> {
    const originais = { ...limites };
    Object.assign(limites, CURTOS);
    try {
      return await fn();
    } finally {
      Object.assign(limites, originais);
    }
  }

  /** Gatilho que levanta exceção no UPDATE da linha do usuário; `soRecalculo`: só quando a sub não muda. */
  async function falharUpdate(userId: string, soRecalculo = false) {
    const nome = `${RUN}_g${gatilhos.length}`;
    const quando = `OLD."userId" = '${userId}'${soRecalculo ? ` AND OLD."externalId" IS NOT DISTINCT FROM NEW."externalId"` : ""}`;
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION "${nome}_fn"() RETURNS trigger AS $f$ BEGIN RAISE EXCEPTION 'falha simulada'; END $f$ LANGUAGE plpgsql`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER "${nome}_trg" BEFORE UPDATE ON "Subscription" FOR EACH ROW WHEN (${quando}) EXECUTE FUNCTION "${nome}_fn"()`,
    );
    gatilhos.push(nome);
    return () => removerGatilho(nome);
  }
  async function removerGatilho(nome: string) {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${nome}_trg" ON "Subscription"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${nome}_fn"()`);
  }

  // A outra conexão solta sozinha depois disto: sem os limites do Postgres, a
  // resposta só viria depois da soltura e o teste FALHA em vez de travar.
  const SEGURAR_MS = CURTOS.timeoutMs + 2_000;

  /** Outra conexão segura um lock numa transação aberta, até soltar (ou SEGURAR_MS). */
  async function outraConexaoSegura(sql: string, params: unknown[]) {
    const conexao = new pg.Client({ connectionString: URL_BANCO });
    await conexao.connect();
    await conexao.query("BEGIN");
    await conexao.query(sql, params);
    let solta = false;
    let soltando: Promise<void> | null = null;
    const soltar = () =>
      (soltando ??= (async () => {
        solta = true;
        clearTimeout(relogio);
        await conexao.query("ROLLBACK");
        await conexao.end();
      })());
    const relogio = setTimeout(() => void soltar(), SEGURAR_MS);
    return { soltar, presa: () => !solta };
  }
  const LINHA_PRESA = 'SELECT id FROM "Subscription" WHERE "userId" = $1 FOR UPDATE';
  const LOCK_DA_SUB = "SELECT pg_advisory_xact_lock(7702, hashtext($1))";

  /** Reentrega depois da falha: aplica uma vez, guarda uma vez, e a seguinte não escreve. */
  async function reentregaAplicaUmaVez(u: string, envio: () => Promise<number>, eventId: string, esperado: Record<string, unknown>) {
    assert.equal(await envio(), 200, "reentrega");
    const depois = await foto(u);
    assert.deepEqual(estado(depois), esperado);
    assert.equal(await guardados(eventId), 1);
    assert.equal(await envio(), 200);
    assert.deepEqual(await foto(u), depois, "mais uma reentrega não escreve");
  }

  it("atomicidade (a): erro DEPOIS de guardar o evento → 500, evento NÃO guardado, linha intacta; a reentrega aplica", async () => {
    const { u, s } = await preparar("atom_a");
    const antes = await foto(u);
    const envio = () => pago(s, "atom_a_p", T, fim(60), {}, f(s, "renovacao"));
    const remover = await falharUpdate(u);
    try {
      assert.equal(await envio(), 500);
    } finally {
      await remover();
    }
    assert.equal(await guardados(evt("atom_a_p")), 0, "o evento foi desfeito junto");
    assert.deepEqual(await foto(u), antes, "Subscription intacta (com updatedAt)");
    await reentregaAplicaUmaVez(u, envio, evt("atom_a_p"), { status: "ACTIVE", expiresAt: em(fim(60)), canceledAt: null });
  });

  it("atomicidade (b): linha da Subscription presa por outra conexão → 500 pelo lock_timeout; nada guardado; a reentrega aplica", async () => {
    const { u, s } = await preparar("atom_b");
    const antes = await foto(u);
    const envio = () => falhou(s, "atom_b_f", T, fim(60), f(s, "renovacao"));
    const { soltar, presa } = await outraConexaoSegura(LINHA_PRESA, [u]);
    let status = 0;
    let duracao = 0;
    try {
      const inicio = Date.now();
      status = await comLimitesCurtos(envio);
      duracao = Date.now() - inicio;
      assert.ok(presa(), `a resposta veio com a linha AINDA presa (${duracao} ms)`);
      // A transação do webhook já terminou desfeita, com a linha ainda presa.
      assert.equal(await guardados(evt("atom_b_f")), 0, "com a linha presa");
    } finally {
      await soltar();
    }
    assert.equal(status, 500);
    assert.ok(duracao >= CURTOS.lockTimeoutMs && duracao < CURTOS.timeoutMs, `cortado pelo lock_timeout, não pelo Prisma: ${duracao} ms`);
    assert.equal(await guardados(evt("atom_b_f")), 0, "linha solta: continua sem o evento");
    assert.deepEqual(await foto(u), antes);
    await reentregaAplicaUmaVez(u, envio, evt("atom_b_f"), { status: "EXPIRED", expiresAt: em(T), canceledAt: em(T) });
  });

  it("atomicidade (c): lock consultivo da sub preso por outra conexão → 500 ANTES de guardar; a reentrega aplica", async () => {
    const { u, s } = await preparar("atom_c");
    const antes = await foto(u);
    const envio = () => cancelado(s, "atom_c_d", T);
    const { soltar, presa } = await outraConexaoSegura(LOCK_DA_SUB, [s]);
    let status = 0;
    try {
      status = await comLimitesCurtos(envio);
      assert.ok(presa(), "a resposta veio com o lock AINDA preso");
      assert.equal(await guardados(evt("atom_c_d")), 0, "com o lock preso");
    } finally {
      await soltar();
    }
    assert.equal(status, 500);
    assert.equal(await guardados(evt("atom_c_d")), 0);
    assert.deepEqual(await foto(u), antes);
    await reentregaAplicaUmaVez(u, envio, evt("atom_c_d"), { status: "CANCELED", expiresAt: em(fim(30)), canceledAt: em(T) });
  });

  it("atomicidade (d): erro no recálculo do completed desfaz o vínculo criado; a reentrega cria e aplica o evento guardado", async () => {
    const u = await usuario("atom_d1");
    const s = sub("atom_d1");
    assert.equal(await pago(s, "atom_d1_p", T0, fim(30)), 200, "legado: fica guardado");
    const remover = await falharUpdate(u, true);
    try {
      assert.equal(await concluido(u, s, "atom_d1_c", T0 + 1), 500);
    } finally {
      await remover();
    }
    assert.equal(await foto(u), null, "nenhum vínculo sem recálculo");
    assert.equal(await guardados(evt("atom_d1_p")), 1, "o evento guardado antes segue lá");
    await reentregaAplicaUmaVez(u, () => concluido(u, s, "atom_d1_c", T0 + 1), evt("atom_d1_p"), {
      status: "ACTIVE",
      expiresAt: em(fim(30)),
      canceledAt: null,
    });
  });

  it("atomicidade (d): erro no recálculo depois da TROCA de vínculo desfaz a troca; a reentrega troca e aplica", async () => {
    const u = await usuario("atom_d2");
    const velha = sub("atom_d2_velha");
    const nova = sub("atom_d2_nova");
    await concluido(u, velha, "atom_d2_cv", T0 + 1);
    await primeira(velha, "atom_d2_pv", T0, fim(30), metadados(u));
    assert.equal(await pago(nova, "atom_d2_pn", T0 + 99, fim(400)), 200, "sem metadados: fica guardado");
    const antes = await foto(u);
    const remover = await falharUpdate(u, true);
    try {
      assert.equal(await concluido(u, nova, "atom_d2_cn", T0 + 100), 500);
    } finally {
      await remover();
    }
    assert.deepEqual(await foto(u), antes, "a troca foi desfeita junto com o recálculo");
    assert.equal(await concluido(u, nova, "atom_d2_cn", T0 + 100), 200);
    const l = await foto(u);
    assert.equal(l.externalId, nova);
    assert.deepEqual(estado(l), { status: "ACTIVE", expiresAt: em(fim(400)), canceledAt: null });
  });

  it("atomicidade (d): completed com o lock da sub preso → 500, sem vínculo; a reentrega cria", async () => {
    const u = await usuario("atom_d3");
    const s = sub("atom_d3");
    const { soltar, presa } = await outraConexaoSegura(LOCK_DA_SUB, [s]);
    let status = 0;
    try {
      status = await comLimitesCurtos(() => concluido(u, s, "atom_d3_c", T0 + 1));
      assert.ok(presa(), "a resposta veio com o lock AINDA preso");
    } finally {
      await soltar();
    }
    assert.equal(status, 500);
    assert.equal(await foto(u), null);
    assert.equal(await concluido(u, s, "atom_d3_c", T0 + 1), 200);
    assert.deepEqual(estado(await foto(u)), { status: "ACTIVE", expiresAt: validadeProvisoria(T0 + 1), canceledAt: null });
  });

  it("assinatura de outro usuário intacta depois de todos os cenários", async () => {
    assert.deepEqual(await fotoDaTestemunha(), testemunhaAntes);
  });
});
