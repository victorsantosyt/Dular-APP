import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import "./_mocks";

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
