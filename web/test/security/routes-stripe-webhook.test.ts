import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  (process.env as Record<string, string | undefined>).NODE_ENV = ORIGINAL_ENV.NODE_ENV;
  process.env.STRIPE_WEBHOOK_SECRET = ORIGINAL_ENV.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_WEBHOOK_ALLOW_UNSIGNED_DEV =
    ORIGINAL_ENV.STRIPE_WEBHOOK_ALLOW_UNSIGNED_DEV;
}

async function getPost() {
  const mod = await import("../../src/app/api/webhooks/stripe/route");
  return mod.POST;
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    resetEnv();
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_ALLOW_UNSIGNED_DEV;
  });

  after(() => {
    resetEnv();
  });

  it("retorna 400 quando webhook secret não está configurado (prod)", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    const POST = await getPost();
    const req = new Request("http://test/api/webhooks/stripe", {
      method: "POST",
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });
    const res = await POST(req);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, "Webhook not configured");
  });

  it("retorna 400 com assinatura inválida quando secret está configurado", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_fake_for_validation";
    const POST = await getPost();
    const req = new Request("http://test/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=invalid" },
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });
    const res = await POST(req);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, "Invalid signature");
  });

  it("rejeita unsigned em prod mesmo com flag DEV ligada", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.STRIPE_WEBHOOK_ALLOW_UNSIGNED_DEV = "true";
    const POST = await getPost();
    const req = new Request("http://test/api/webhooks/stripe", {
      method: "POST",
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });
    const res = await POST(req);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, "Webhook not configured");
  });

  it("rejeita unsigned em dev quando flag DEV não está ligada", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    const POST = await getPost();
    const req = new Request("http://test/api/webhooks/stripe", {
      method: "POST",
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });
    const res = await POST(req);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, "Webhook not configured");
  });

  it("rejeita secret placeholder (com '...') mesmo em prod", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_...placeholder";
    const POST = await getPost();
    const req = new Request("http://test/api/webhooks/stripe", {
      method: "POST",
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });
    const res = await POST(req);
    assert.equal(res.status, 400);
  });

  it("rejeita secret que não começa com 'whsec_'", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.STRIPE_WEBHOOK_SECRET = "rk_live_definitely_wrong";
    const POST = await getPost();
    const req = new Request("http://test/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": "anything" },
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });
    const res = await POST(req);
    assert.equal(res.status, 400);
  });
});

describe("POST /api/webhooks/stripe — fluxo positivo (constructEvent mockado)", () => {
  let originalConstructEvent: unknown;
  const CRIADO = 1_790_000_000;

  async function postar() {
    const POST = await getPost();
    return POST(
      new Request("http://test/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=dummy" },
        body: "{}",
      }),
    );
  }

  const raiz = mockPrisma as unknown as Record<string, unknown>;

  /**
   * Transação interativa cujo `tx` é o próprio mock. Devolve os locks pedidos;
   * confere que os limites de tempo (SET LOCAL) vêm antes de cada lock.
   */
  function instalarTransacao() {
    const travas: string[] = [];
    let limites = 0;
    raiz.$transaction = async (fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma);
    raiz.$executeRaw = async (sql: TemplateStringsArray, ...valores: unknown[]) => {
      const texto = sql.join("?");
      if (texto.includes("set_config('lock_timeout'")) limites += 1;
      if (!texto.includes("pg_advisory_xact_lock")) return 1;
      assert.equal(limites, travas.length + 1, "lock_timeout/statement_timeout antes do lock");
      travas.push(String(valores[0]));
      return 1;
    };
    return travas;
  }

  beforeEach(async () => {
    resetEnv();
    resetMockPrisma();
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_only_dummy";

    const { stripe } = await import("../../src/lib/stripe");
    originalConstructEvent = stripe.webhooks.constructEvent.bind(stripe.webhooks);
  });

  after(async () => {
    if (originalConstructEvent) {
      const { stripe } = await import("../../src/lib/stripe");
      stripe.webhooks.constructEvent = originalConstructEvent as never;
    }
    resetEnv();
  });

  it("checkout.session.completed em modo subscription cria o vínculo (createMany skipDuplicates) sob a trava da pessoa e o lock da sub", async () => {
    const { stripe, PLANS, validadeDoPlano } = await import("../../src/lib/stripe");
    stripe.webhooks.constructEvent = (() => ({
      id: "evt_test_completed_1",
      created: CRIADO,
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          client_reference_id: "u-1",
          subscription: "sub_test_123",
          metadata: { userId: "u-1", planId: "pro_mensal", subscriptionPlan: "PREMIUM", operacao: "dular-checkout-prova-u-1" },
        },
      },
    })) as never;
    // Prova de origem: a operação `checkout` que a rota gravou para este usuário e plano.
    mockPrisma.stripeOperacao.findUnique = async () => ({ tipo: "checkout", userId: "u-1", planId: "pro_mensal", referencia: null, externalId: null });

    const travas = instalarTransacao();
    let createArgs: { data?: Array<Record<string, unknown>>; skipDuplicates?: boolean } | null = null;
    const tocadas: string[] = [];
    (mockPrisma.subscription as Record<string, unknown>).createMany = async (args: typeof createArgs) => {
      createArgs = args;
      return { count: 1 };
    };
    // Recálculo depois de criar: a linha recém-criada, sem eventos guardados.
    mockPrisma.subscription.findFirst = async () => ({ id: "row-1", ...createArgs!.data![0] });
    raiz.stripeEventoAssinatura = { findMany: async () => [] };
    mockPrisma.subscription.upsert = async () => void tocadas.push("upsert");
    mockPrisma.subscription.updateMany = async () => void tocadas.push("updateMany");

    const res = await postar();

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.received, true);
    const quando = new Date(CRIADO * 1000);
    assert.equal(createArgs!.skipDuplicates, true);
    assert.deepEqual(createArgs!.data, [
      {
        userId: "u-1",
        plan: "PREMIUM",
        status: "ACTIVE",
        provider: "STRIPE",
        externalId: "sub_test_123",
        storeProductId: null,
        startedAt: quando,
        // Provisória: o período efetivo vem dos eventos de ciclo de vida.
        expiresAt: validadeDoPlano(PLANS.pro_mensal, quando),
        canceledAt: null,
        stripeBase: {
          status: "ACTIVE",
          expiresAt: validadeDoPlano(PLANS.pro_mensal, quando).toISOString(),
          canceledAt: null,
        },
      },
    ]);
    // A trava da pessoa (com o checkout e a compra de loja, issue #359) e, dentro dela, a da sub.
    assert.deepEqual(travas, ["u-1", "sub_test_123"]);
    assert.deepEqual(tocadas, [], "criou e nada mudou no recálculo: nenhuma outra escrita");
  });

  it("checkout.session.completed sem id/created do evento: nada gravado, erro no log", async () => {
    const { stripe } = await import("../../src/lib/stripe");
    stripe.webhooks.constructEvent = (() => ({
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          client_reference_id: "u-1",
          subscription: "sub_test_123",
          metadata: { planId: "pro_mensal" },
        },
      },
    })) as never;
    const tocadas: string[] = [];
    (mockPrisma.subscription as Record<string, unknown>).createMany = async () => void tocadas.push("createMany");
    mockPrisma.subscription.updateMany = async () => void tocadas.push("updateMany");
    raiz.$transaction = async () => void tocadas.push("$transaction");
    const erros: unknown[][] = [];
    const errorOriginal = console.error;
    console.error = (...a: unknown[]) => void erros.push(a);
    try {
      const res = await postar();
      assert.equal(res.status, 200);
    } finally {
      console.error = errorOriginal;
    }
    assert.deepEqual(tocadas, []);
    assert.ok(erros.some((e) => String(e[0]).includes("sem id ou created")));
  });

  it("checkout.session.completed com subscription que não é sub_: nada gravado", async () => {
    const { stripe } = await import("../../src/lib/stripe");
    const tocadas: string[] = [];
    (mockPrisma.subscription as Record<string, unknown>).createMany = async () => void tocadas.push("createMany");
    mockPrisma.subscription.updateMany = async () => void tocadas.push("updateMany");
    raiz.$transaction = async () => void tocadas.push("$transaction");
    const errorOriginal = console.error;
    console.error = () => {};
    try {
      for (const subscription of [null, "", "in_test_123", 123]) {
        stripe.webhooks.constructEvent = (() => ({
          id: "evt_test_completed_2",
          created: CRIADO,
          type: "checkout.session.completed",
          data: { object: { mode: "subscription", client_reference_id: "u-1", subscription, metadata: { planId: "pro_mensal" } } },
        })) as never;
        assert.equal((await postar()).status, 200);
      }
    } finally {
      console.error = errorOriginal;
    }
    assert.deepEqual(tocadas, []);
  });

  it("checkout.session.completed em modo payment credita CreditWallet", async () => {
    const { stripe } = await import("../../src/lib/stripe");
    stripe.webhooks.constructEvent = (() => ({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_credito_1",
          mode: "payment",
          payment_status: "paid",
          client_reference_id: "u-1",
          metadata: { credits: "5" },
        },
      },
    })) as never;

    let walletUpserted = false;
    let txCreated = false;
    mockPrisma.creditWallet.upsert = async () => {
      walletUpserted = true;
      return { id: "wallet-1", userId: "u-1", balance: 5 };
    };
    mockPrisma.creditTransaction.create = async () => {
      txCreated = true;
      return { id: "tx-1" };
    };

    const POST = await getPost();
    const req = new Request("http://test/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=dummy" },
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });
    const res = await POST(req);

    assert.equal(res.status, 200);
    assert.equal(walletUpserted, true);
    assert.equal(txCreated, true);
  });

  it("ignora evento sem client_reference_id (no-op silencioso, 200)", async () => {
    const { stripe } = await import("../../src/lib/stripe");
    stripe.webhooks.constructEvent = (() => ({
      type: "checkout.session.completed",
      data: { object: { mode: "subscription", client_reference_id: null, metadata: {} } },
    })) as never;

    const tocadas: string[] = [];
    mockPrisma.subscription.upsert = async () => void tocadas.push("upsert");
    mockPrisma.subscription.updateMany = async () => void tocadas.push("updateMany");
    (mockPrisma.subscription as Record<string, unknown>).createMany = async () => void tocadas.push("createMany");
    raiz.$transaction = async () => void tocadas.push("$transaction");

    const res = await postar();

    assert.equal(res.status, 200);
    assert.deepEqual(tocadas, [], "sem userId não deve persistir nada");
  });

  describe("customer.subscription.deleted", () => {
    const quando = new Date(CRIADO * 1000);
    const pago = new Date("2026-12-31T00:00:00Z");

    async function excluir(primeiraEntrega: boolean) {
      const { stripe } = await import("../../src/lib/stripe");
      stripe.webhooks.constructEvent = (() => ({
        id: "evt_test_deleted_1",
        created: CRIADO,
        type: "customer.subscription.deleted",
        data: { object: { id: "sub_to_cancel" } },
      })) as never;

      const travas = instalarTransacao();
      const guardados: Array<Record<string, unknown>> = [];
      let createArgs: { data?: Array<Record<string, unknown>>; skipDuplicates?: boolean } | null = null;
      raiz.stripeEventoAssinatura = {
        createMany: async (args: typeof createArgs) => {
          createArgs = args;
          if (!primeiraEntrega) return { count: 0 };
          guardados.push(...args!.data!);
          return { count: 1 };
        },
        findMany: async () => guardados,
      };
      const tocadas: string[] = [];
      mockPrisma.subscription.findFirst = async () => {
        tocadas.push("findFirst");
        return {
          id: "row-1",
          status: "ACTIVE",
          expiresAt: pago,
          canceledAt: null,
          stripeBase: { status: "ACTIVE", expiresAt: pago.toISOString(), canceledAt: null },
        };
      };
      type Atualizacao = { where?: Record<string, unknown>; data?: Record<string, unknown> };
      let updateArgs: Atualizacao | null = null;
      mockPrisma.subscription.updateMany = async (args: Atualizacao) => {
        tocadas.push("updateMany");
        updateArgs = args;
        return { count: 1 };
      };

      const res = await postar();
      assert.equal(res.status, 200);
      return { travas, createArgs: createArgs!, tocadas, updateArgs: updateArgs as Atualizacao | null };
    }

    it("guarda o evento e grava CANCELED recalculado, sob o lock da sub", async () => {
      const { travas, createArgs, updateArgs } = await excluir(true);

      assert.deepEqual(travas, ["sub_to_cancel"]);
      assert.equal(createArgs.skipDuplicates, true);
      assert.deepEqual(createArgs.data, [
        {
          eventId: "evt_test_deleted_1",
          externalId: "sub_to_cancel",
          tipo: "customer.subscription.deleted",
          criadoEm: quando,
          fimPeriodo: null,
          faturaId: null,
        },
      ]);
      assert.deepEqual(updateArgs!.where, { id: "row-1", provider: "STRIPE", externalId: "sub_to_cancel" });
      // Cancelou: vale até o fim do que pagou. A base já existe: não é regravada.
      assert.deepEqual(updateArgs!.data, { status: "CANCELED", expiresAt: pago, canceledAt: quando });
    });

    it("evento já guardado (reentrega): nada mais é lido nem escrito", async () => {
      const { travas, tocadas } = await excluir(false);

      assert.deepEqual(travas, ["sub_to_cancel"]);
      assert.deepEqual(tocadas, []);
    });
  });
});
