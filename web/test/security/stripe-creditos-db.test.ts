import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

/**
 * Compra de créditos pelo webhook Stripe contra Postgres REAL: entregas
 * simultâneas e falha no meio da transação. O banco simulado de
 * stripe-creditos-idempotentes.test.ts executa uma transação por vez; aqui a
 * concorrência e o rollback são os do Postgres, com o índice único da
 * migration 20260930120000_credito_sessao_checkout.
 *
 * Mesmo protocolo das outras suítes de banco: SAFESCORE_DB_URL local;
 * obrigatório no CI (SAFESCORE_DB_REQUIRED=1). Eventos sintéticos assinados
 * pelo SDK com segredo fictício — nenhuma chamada à Stripe.
 */

const URL_BANCO = process.env.SAFESCORE_DB_URL;
const PULAR = !URL_BANCO
  ? "defina SAFESCORE_DB_URL (Postgres local com as migrations aplicadas)"
  : !/@(localhost|127\.0\.0\.1)[:/]/.test(URL_BANCO)
    ? "SAFESCORE_DB_URL não aponta para localhost — recusado"
    : false;
const EXIGIDO = process.env.SAFESCORE_DB_REQUIRED === "1";
const SEGREDO = "whsec_ficticio_creditos_db";

describe("créditos do webhook Stripe contra Postgres real", { skip: EXIGIDO ? false : PULAR }, () => {
  let prisma: any;
  let post: (req: Request) => Promise<Response>;
  let assinar: (payload: string) => string;

  const RUN = `t_cred_${Date.now().toString(36)}`;
  let testemunha = "";
  let testemunhaAntes: unknown = null;
  const usuarios: string[] = [];
  const gatilhos: string[] = [];
  let n = 0;

  async function usuario(sufixo: string, saldoInicial?: number) {
    const id = `${RUN}_${sufixo}`;
    await prisma.user.create({ data: { id, nome: `Teste créditos ${sufixo}`, role: "DIARISTA" } });
    usuarios.push(id);
    if (saldoInicial !== undefined) await prisma.creditWallet.create({ data: { userId: id, balance: saldoInicial } });
    return id;
  }

  async function enviar(
    userId: string,
    sessaoId: string,
    credits = "5",
    opcoes: { tipo?: string; pagamento?: string } = {},
  ) {
    const payload = JSON.stringify({
      id: `evt_${RUN}_${++n}`,
      object: "event",
      type: opcoes.tipo ?? "checkout.session.completed",
      api_version: "2026-04-22.dahlia",
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: sessaoId,
          object: "checkout.session",
          mode: "payment",
          payment_status: opcoes.pagamento ?? "paid",
          client_reference_id: userId,
          metadata: { credits },
        },
      },
    });
    const res = await post(
      new Request("http://test/api/webhooks/stripe", { method: "POST", headers: { "stripe-signature": assinar(payload) }, body: payload }),
    );
    return res.status;
  }

  async function estado(userId: string) {
    const w = await prisma.creditWallet.findUnique({ where: { userId }, select: { id: true, balance: true } });
    const lancamentos = w ? await prisma.creditTransaction.count({ where: { walletId: w.id } }) : 0;
    return { saldo: w?.balance ?? null, lancamentos };
  }

  before(async () => {
    if (PULAR) throw new Error(`SAFESCORE_DB_REQUIRED=1, mas ${PULAR}`);
    process.env.DATABASE_URL = URL_BANCO;
    process.env.STRIPE_WEBHOOK_SECRET = SEGREDO;
    process.env.STRIPE_SECRET_KEY ??= "sk_test_ficticio_sem_uso_de_rede";
    ({ prisma } = await import("../../src/lib/prisma"));
    const { stripe } = await import("../../src/lib/stripe");
    assinar = (payload) => stripe.webhooks.generateTestHeaderString({ payload, secret: SEGREDO });
    post = (await import("../../src/app/api/webhooks/stripe/route")).POST;

    // Carteira de outro usuário, gravada antes de tudo: não pode mudar.
    testemunha = await usuario("testemunha", 7);
    const w = await prisma.creditWallet.findUnique({ where: { userId: testemunha }, select: { id: true } });
    await prisma.creditTransaction.create({
      data: { walletId: w.id, type: "CREDIT", amount: 7, stripeCheckoutSessionId: `cs_${RUN}_testemunha` },
    });
    testemunhaAntes = await fotoDaCarteira(testemunha);
  });

  async function fotoDaCarteira(userId: string) {
    return prisma.creditWallet.findUnique({
      where: { userId },
      select: { balance: true, updatedAt: true, transactions: { select: { id: true, amount: true, stripeCheckoutSessionId: true } } },
    });
  }

  after(async () => {
    if (!prisma) return;
    for (const nome of gatilhos) {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${nome}_trg" ON "CreditTransaction"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${nome}_fn"()`);
    }
    await prisma.creditTransaction.deleteMany({ where: { wallet: { userId: { in: usuarios } } } });
    await prisma.creditWallet.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.user.deleteMany({ where: { id: { in: usuarios } } });
    await prisma.$disconnect();
  });

  it("5 entregas simultâneas, usuário SEM carteira: +5 uma vez", async () => {
    const u = await usuario("novo");
    const status = await Promise.all(Array.from({ length: 5 }, () => enviar(u, `cs_${RUN}_novo`)));
    assert.deepEqual(status, [200, 200, 200, 200, 200], `status reais: ${JSON.stringify(status)}`);
    assert.deepEqual(await estado(u), { saldo: 5, lancamentos: 1 });
  });

  it("5 entregas simultâneas, carteira existente: +5 uma vez", async () => {
    const u = await usuario("existente", 3);
    const status = await Promise.all(Array.from({ length: 5 }, () => enviar(u, `cs_${RUN}_existente`)));
    assert.deepEqual(status, [200, 200, 200, 200, 200], `status reais: ${JSON.stringify(status)}`);
    assert.deepEqual(await estado(u), { saldo: 8, lancamentos: 1 });
  });

  it("mesma sessão em entregas sequenciais: +5 uma vez", async () => {
    const u = await usuario("sequencial");
    for (let i = 0; i < 3; i++) assert.equal(await enviar(u, `cs_${RUN}_sequencial`), 200);
    assert.deepEqual(await estado(u), { saldo: 5, lancamentos: 1 });
  });

  it("falha ao gravar o lançamento: 500, saldo intacto; o reenvio credita uma vez", async () => {
    const u = await usuario("falha", 3);
    const w = await prisma.creditWallet.findUnique({ where: { userId: u }, select: { id: true } });
    const nome = `${RUN}_g`;
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION "${nome}_fn"() RETURNS trigger AS $f$ BEGIN IF NEW."walletId" = '${w.id}' THEN RAISE EXCEPTION 'falha simulada'; END IF; RETURN NEW; END $f$ LANGUAGE plpgsql`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER "${nome}_trg" BEFORE INSERT ON "CreditTransaction" FOR EACH ROW EXECUTE FUNCTION "${nome}_fn"()`,
    );
    gatilhos.push(nome);

    assert.equal(await enviar(u, `cs_${RUN}_falha`), 500);
    assert.deepEqual(await estado(u), { saldo: 3, lancamentos: 0 }, "o incremento foi desfeito junto");

    await prisma.$executeRawUnsafe(`DROP TRIGGER "${nome}_trg" ON "CreditTransaction"`);
    assert.equal(await enviar(u, `cs_${RUN}_falha`), 200);
    assert.equal(await enviar(u, `cs_${RUN}_falha`), 200);
    assert.deepEqual(await estado(u), { saldo: 8, lancamentos: 1 });
  });

  const SUCESSO = "checkout.session.async_payment_succeeded";
  const RECUSA = "checkout.session.async_payment_failed";

  it("boleto/Pix: completed pendente não credita; 5 confirmações simultâneas creditam +5 uma vez", async () => {
    const u = await usuario("assincrono");
    assert.equal(await enviar(u, `cs_${RUN}_assincrono`, "5", { pagamento: "unpaid" }), 200);
    assert.deepEqual(await estado(u), { saldo: null, lancamentos: 0 });
    const status = await Promise.all(Array.from({ length: 5 }, () => enviar(u, `cs_${RUN}_assincrono`, "5", { tipo: SUCESSO })));
    assert.deepEqual(status, [200, 200, 200, 200, 200], `status reais: ${JSON.stringify(status)}`);
    assert.deepEqual(await estado(u), { saldo: 5, lancamentos: 1 });
  });

  it("completed pago e confirmação assíncrona da mesma sessão ao mesmo tempo: +5 uma vez", async () => {
    const u = await usuario("ambos", 3);
    const status = await Promise.all([
      enviar(u, `cs_${RUN}_ambos`),
      enviar(u, `cs_${RUN}_ambos`, "5", { tipo: SUCESSO }),
      enviar(u, `cs_${RUN}_ambos`),
      enviar(u, `cs_${RUN}_ambos`, "5", { tipo: SUCESSO }),
    ]);
    assert.deepEqual(status, [200, 200, 200, 200], `status reais: ${JSON.stringify(status)}`);
    assert.deepEqual(await estado(u), { saldo: 8, lancamentos: 1 });
  });

  it("pagamento recusado: nada creditado", async () => {
    const u = await usuario("recusado", 3);
    assert.equal(await enviar(u, `cs_${RUN}_recusado`, "5", { pagamento: "unpaid" }), 200);
    assert.equal(await enviar(u, `cs_${RUN}_recusado`, "5", { tipo: RECUSA, pagamento: "unpaid" }), 200);
    assert.deepEqual(await estado(u), { saldo: 3, lancamentos: 0 });
  });

  it("quantidade inválida: nada gravado", async () => {
    const u = await usuario("invalido", 3);
    for (const credits of ["abc", "2.5", "999999999999", "0"]) assert.equal(await enviar(u, `cs_${RUN}_inv_${credits}`, credits), 200);
    assert.deepEqual(await estado(u), { saldo: 3, lancamentos: 0 });
  });

  it("carteira de outro usuário intacta depois de todos os cenários", async () => {
    assert.deepEqual(await fotoDaCarteira(testemunha), testemunhaAntes);
  });
});
