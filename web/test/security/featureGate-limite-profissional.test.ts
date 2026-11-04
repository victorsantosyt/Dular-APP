import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";

async function getGate() {
  const mod = await import("../../src/lib/featureGate");
  return mod.checkFeatureAccess;
}

/** Registra o que o count recebeu, para provar o escopo por papel. */
function capturarEscopo(retorno: number) {
  let capturado: Record<string, unknown> | null = null;
  mockPrisma.servico.count = async (args: any) => {
    capturado = args?.where ?? null;
    return retorno;
  };
  return () => capturado;
}

describe("featureGate — limite do PROFISSIONAL (quem paga)", () => {
  beforeEach(() => resetMockPrisma());

  it("bloqueia a DIARISTA no gratuito ao chegar em 5 serviços no mês", async () => {
    mockPrisma.user.findUnique = async () => ({ id: "u-dia", role: "DIARISTA" });
    mockPrisma.subscription.findUnique = async () => null; // sem assinatura → FREE
    mockPrisma.featureLimit.findUnique = async () => ({ limit: 5, enabled: true });
    capturarEscopo(5);

    const check = await getGate();
    const r = await check("u-dia", "SOLICITACOES_MES");

    assert.equal(r.allowed, false, "5 de 5 deve bloquear");
    assert.equal(r.plan, "FREE");
    assert.equal(r.limit, 5);
  });

  it("libera a DIARISTA com 4 de 5", async () => {
    mockPrisma.user.findUnique = async () => ({ id: "u-dia", role: "DIARISTA" });
    mockPrisma.subscription.findUnique = async () => null;
    mockPrisma.featureLimit.findUnique = async () => ({ limit: 5, enabled: true });
    capturarEscopo(4);

    const check = await getGate();
    assert.equal((await check("u-dia", "SOLICITACOES_MES")).allowed, true);
  });

  it("conta o MONTADOR pelos serviços dele, não pelos que ele contratou", async () => {
    // O código antes só tratava DIARISTA e jogava todo o resto no escopo do
    // cliente (`clientId`). Para o montador isso dava sempre zero — ele nunca
    // seria limitado.
    mockPrisma.user.findUnique = async () => ({ id: "u-mon", role: "MONTADOR" });
    mockPrisma.subscription.findUnique = async () => null;
    mockPrisma.featureLimit.findUnique = async () => ({ limit: 5, enabled: true });
    const escopo = capturarEscopo(5);

    const check = await getGate();
    const r = await check("u-mon", "SOLICITACOES_MES");

    assert.deepEqual(escopo()?.montadorId, "u-mon", "deve contar por montadorId");
    assert.equal(escopo()?.clientId, undefined, "não pode contar como contratante");
    assert.equal(r.allowed, false);
  });

  it("assinatura vencida cai para FREE e volta a limitar", async () => {
    mockPrisma.user.findUnique = async () => ({ id: "u-dia", role: "DIARISTA" });
    // PREMIUM, porém EXPIRED: o gate rebaixa para FREE.
    mockPrisma.subscription.findUnique = async () => ({ plan: "PREMIUM", status: "EXPIRED" });
    mockPrisma.featureLimit.findUnique = async () => ({ limit: 5, enabled: true });
    capturarEscopo(5);

    const check = await getGate();
    const r = await check("u-dia", "SOLICITACOES_MES");

    assert.equal(r.plan, "FREE", "EXPIRED não vale como plano ativo");
    assert.equal(r.allowed, false);
  });

  it("PREMIUM ativo com limite nulo é ilimitado", async () => {
    mockPrisma.user.findUnique = async () => ({ id: "u-dia", role: "DIARISTA" });
    mockPrisma.subscription.findUnique = async () => ({ plan: "PREMIUM", status: "ACTIVE" });
    mockPrisma.featureLimit.findUnique = async () => ({ limit: null, enabled: true });
    capturarEscopo(999);

    const check = await getGate();
    const r = await check("u-dia", "SOLICITACOES_MES");

    assert.equal(r.allowed, true);
    assert.equal(r.limit, null);
  });

  it("devolve a janela da contagem, igual à usada no count (o app não fixa período)", async () => {
    mockPrisma.user.findUnique = async () => ({ id: "u-dia", role: "DIARISTA" });
    mockPrisma.subscription.findUnique = async () => null;
    mockPrisma.featureLimit.findUnique = async () => ({ limit: 5, enabled: true });
    const escopo = capturarEscopo(1);

    const check = await getGate();
    const r = await check("u-dia", "SOLICITACOES_MES");
    const criado = (escopo() as any)?.createdAt;
    assert.ok(r.periodo, "periodo presente");
    assert.equal(r.periodo!.inicio, criado.gte.toISOString());
    assert.equal(r.periodo!.fim, criado.lt.toISOString());
  });
});
