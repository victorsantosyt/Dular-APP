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

  it("checkout.session.completed em modo subscription faz upsert na Subscription", async () => {
    const { stripe } = await import("../../src/lib/stripe");
    stripe.webhooks.constructEvent = (() => ({
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          client_reference_id: "u-1",
          subscription: "sub_test_123",
          metadata: { subscriptionPlan: "PREMIUM" },
        },
      },
    })) as never;

    let upsertCalled = false;
    let upsertedArgs: { where?: unknown; update?: { plan?: string } } | null = null;
    mockPrisma.subscription.upsert = async (args: { where?: unknown; update?: { plan?: string } }) => {
      upsertCalled = true;
      upsertedArgs = args;
      return { id: "subs-1" };
    };

    const POST = await getPost();
    const req = new Request("http://test/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=dummy" },
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });
    const res = await POST(req);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.received, true);
    assert.equal(upsertCalled, true);
    assert.equal(upsertedArgs!.update!.plan, "PREMIUM");
  });

  it("checkout.session.completed em modo payment credita CreditWallet", async () => {
    const { stripe } = await import("../../src/lib/stripe");
    stripe.webhooks.constructEvent = (() => ({
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "payment",
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

    let upsertCalled = false;
    mockPrisma.subscription.upsert = async () => {
      upsertCalled = true;
      return { id: "x" };
    };

    const POST = await getPost();
    const req = new Request("http://test/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=dummy" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);

    assert.equal(res.status, 200);
    assert.equal(upsertCalled, false, "sem userId não deve persistir nada");
  });

  it("customer.subscription.deleted marca CANCELED via updateMany", async () => {
    const { stripe } = await import("../../src/lib/stripe");
    stripe.webhooks.constructEvent = (() => ({
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_to_cancel" } },
    })) as never;

    let updateArgs: { where?: { externalId?: string }; data?: { status?: string } } | null = null;
    mockPrisma.subscription.updateMany = async (
      args: { where?: { externalId?: string }; data?: { status?: string } },
    ) => {
      updateArgs = args;
      return { count: 1 };
    };

    const POST = await getPost();
    const req = new Request("http://test/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=dummy" },
      body: "{}",
    });
    const res = await POST(req);

    assert.equal(res.status, 200);
    assert.equal(updateArgs!.where!.externalId, "sub_to_cancel");
    assert.equal(updateArgs!.data!.status, "CANCELED");
  });
});
