import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";

/**
 * A validade da assinatura decide o acesso.
 *
 * Antes o gate olhava só o `status`, e o status só muda quando chega o aviso do
 * provedor. Perdido esse aviso — endpoint fora do ar, assinatura inválida,
 * notificação não reenviada —, a assinatura ficava ACTIVE para sempre e a
 * pessoa mantinha acesso ilimitado sem pagar. Estes testes existem para essa
 * rede não sumir num refactor futuro.
 */

async function getGate() {
  const mod = await import("../../src/lib/featureGate");
  return mod.checkFeatureAccess;
}

const DIAS = 24 * 60 * 60 * 1000;

function comAssinatura(plan: string, status: string, expiresAt: Date | null) {
  mockPrisma.user.findUnique = async () => ({ id: "u-1", role: "DIARISTA" });
  mockPrisma.subscription.findUnique = async () => ({ plan, status, expiresAt });
  // O limite depende do plano que o gate CONCLUIU valer — é justamente isso
  // que está sob teste. Devolver 5 para todos esconderia a diferença entre
  // "caiu para FREE" e "seguiu PREMIUM".
  mockPrisma.featureLimit.findUnique = async (args: any) => {
    const plano = args?.where?.plan_feature?.plan;
    return { limit: plano === "PREMIUM" ? null : 5, enabled: true };
  };
  mockPrisma.servico.count = async () => 5; // já no limite do gratuito
}

describe("assinatura — a validade conta, não só o status", () => {
  beforeEach(() => resetMockPrisma());

  it("ACTIVE mas VENCIDA cai para FREE e bloqueia", async () => {
    comAssinatura("PREMIUM", "ACTIVE", new Date(Date.now() - 10 * DIAS));
    const r = await (await getGate())("u-1", "SOLICITACOES_MES");

    assert.equal(r.plan, "FREE", "vencida não vale mais PREMIUM");
    assert.equal(r.allowed, false, "sem plano válido, 5 de 5 bloqueia");
  });

  it("ACTIVE dentro do prazo mantém o plano", async () => {
    comAssinatura("PREMIUM", "ACTIVE", new Date(Date.now() + 20 * DIAS));
    const r = await (await getGate())("u-1", "SOLICITACOES_MES");

    assert.equal(r.plan, "PREMIUM");
    assert.equal(r.allowed, true, "PREMIUM não tem limite");
  });

  it("sem data de validade vale o status — é o caso do plano dado na mão", async () => {
    comAssinatura("PREMIUM", "ACTIVE", null);
    const r = await (await getGate())("u-1", "SOLICITACOES_MES");

    assert.equal(r.plan, "PREMIUM");
    assert.equal(r.allowed, true);
  });

  it("CANCELED cai para FREE mesmo dentro do prazo", async () => {
    comAssinatura("PREMIUM", "CANCELED", new Date(Date.now() + 20 * DIAS));
    const r = await (await getGate())("u-1", "SOLICITACOES_MES");

    assert.equal(r.plan, "FREE");
    assert.equal(r.allowed, false);
  });
});

describe("validade calculada a partir do intervalo do plano", () => {
  it("mensal anda um mês; anual anda um ano", async () => {
    const { PLANS, validadeDoPlano } = await import("../../src/lib/stripe");
    const base = new Date("2026-09-09T12:00:00Z");

    assert.equal(
      validadeDoPlano(PLANS.pro_mensal, base).toISOString().slice(0, 10),
      "2026-10-09",
    );
    // O anual gravava 1 MÊS de validade — 11 meses a menos do que foi pago.
    assert.equal(
      validadeDoPlano(PLANS.pro_anual, base).toISOString().slice(0, 10),
      "2027-09-09",
    );
  });

  it("não transborda no mês curto: 31/01 vira 28/02, não 03/03", async () => {
    const { PLANS, validadeDoPlano } = await import("../../src/lib/stripe");

    assert.equal(
      validadeDoPlano(PLANS.pro_mensal, new Date("2026-01-31T12:00:00Z"))
        .toISOString()
        .slice(0, 10),
      "2026-02-28",
      "setMonth cru daria 03/03 e três dias de graça",
    );
    assert.equal(
      validadeDoPlano(PLANS.pro_mensal, new Date("2028-01-31T12:00:00Z"))
        .toISOString()
        .slice(0, 10),
      "2028-02-29",
      "ano bissexto",
    );
  });
});

describe("catálogo — todo plano tem produto de loja, e ids não se repetem", () => {
  it("os seis planos têm storeProductId único", async () => {
    const { PLANS } = await import("../../src/lib/stripe");
    const ids = Object.values(PLANS).map((p) => p.storeProductId);

    assert.equal(ids.length, 6);
    assert.ok(ids.every((id) => typeof id === "string" && id.length > 0));
    assert.equal(new Set(ids).size, ids.length, "id repetido daria plano errado");
  });

  it("o id da loja volta para o plano certo", async () => {
    const { PLANS, planoPorProdutoDaLoja } = await import("../../src/lib/stripe");

    for (const plano of Object.values(PLANS)) {
      assert.equal(planoPorProdutoDaLoja(plano.storeProductId)?.id, plano.id);
    }
    assert.equal(planoPorProdutoDaLoja("nao.existe"), null);
  });
});
