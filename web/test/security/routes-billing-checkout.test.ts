import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { jsonRequest, makeAuthHeaders } from "./_helpers";

// O checkout grava os metadados também na ASSINATURA (`subscription_data`):
// eles chegam em `parent.subscription_details.metadata` da primeira fatura, e é
// por eles que o `invoice.paid` — que chega antes do `completed` — cria o
// vínculo. Sem eles, o pagamento da compra não teria a quem se aplicar.
// Nenhuma chamada à Stripe: `checkout.sessions.create` é substituído.

type Params = Record<string, unknown> & { metadata?: unknown; subscription_data?: { metadata?: unknown } };

describe("POST /api/billing/checkout — metadados da assinatura", () => {
  let criarOriginal: unknown = null;
  let criadas: Params[] = [];

  beforeEach(async () => {
    resetMockPrisma();
    mockPrisma.user.findUnique = async () => ({ status: "ATIVO", email: "profissional@teste.invalid" });
    // Sem assinatura: o pedido vai ao Checkout (lib/trocaDePlano), sob a trava
    // da pessoa e com a operação gravada antes da chamada à Stripe.
    const raiz = mockPrisma as unknown as Record<string, unknown>;
    raiz.$transaction = async (fn: (tx: unknown) => Promise<unknown>) => fn({ $executeRaw: async () => 1 });
    mockPrisma.subscription.findUnique = async () => null;
    mockPrisma.stripeOperacao.create = async (args: { data: Record<string, unknown> }) => ({ id: "op-1", ...args.data });
    mockPrisma.stripeOperacao.update = async () => ({});
    const { stripe } = await import("../../src/lib/stripe");
    criarOriginal ??= stripe.checkout.sessions.create;
    criadas = [];
    stripe.checkout.sessions.create = (async (params: Params) => {
      criadas.push(params);
      return { id: "cs_test_ficticio_checkout", url: "https://checkout.stripe.test/cs_test_ficticio_checkout" };
    }) as never;
  });

  after(async () => {
    if (!criarOriginal) return;
    const { stripe } = await import("../../src/lib/stripe");
    stripe.checkout.sessions.create = criarOriginal as never;
  });

  async function checkout(userId: string, role: "DIARISTA" | "MONTADOR", body: unknown) {
    const { POST } = await import("../../src/app/api/billing/checkout/route");
    return POST(jsonRequest("http://test/api/billing/checkout", body, makeAuthHeaders(userId, role)));
  }

  for (const [role, planId, subscriptionPlan] of [
    ["DIARISTA", "pro_anual", "PREMIUM"],
    ["DIARISTA", "basico_mensal", "BASIC"],
    ["MONTADOR", "montador_pro_mensal", "PREMIUM"],
  ] as const) {
    it(`${planId}: userId, planId e subscriptionPlan na sessão E na assinatura`, async () => {
      const userId = `u-checkout-${planId}`;
      const res = await checkout(userId, role, { planId });

      assert.equal(res.status, 200);
      assert.equal(criadas.length, 1);
      const esperado = { userId, planId, subscriptionPlan };
      assert.deepEqual(criadas[0].metadata, esperado);
      assert.deepEqual(criadas[0].subscription_data, { metadata: esperado });
      assert.equal(criadas[0].client_reference_id, userId);
    });
  }

  it("plano legado (plano: PLUS) também leva os metadados resolvidos para a assinatura", async () => {
    const res = await checkout("u-checkout-legado", "DIARISTA", { plano: "PLUS" });

    assert.equal(res.status, 200);
    assert.deepEqual(criadas[0].subscription_data, {
      metadata: { userId: "u-checkout-legado", planId: "basico_mensal", subscriptionPlan: "BASIC" },
    });
  });

  it("plano de outro papel: 403 e nenhuma sessão criada", async () => {
    const res = await checkout("u-checkout-papel", "MONTADOR", { planId: "pro_anual" });

    assert.equal(res.status, 403);
    assert.equal(criadas.length, 0);
  });
});
