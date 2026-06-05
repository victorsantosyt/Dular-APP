import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { makeAuthHeaders, jsonRequest } from "./_helpers";

async function getPost() {
  const mod = await import("../../src/app/api/servicos/route");
  return mod.POST;
}

// EMPREGADOR ATIVO que passa pelo Guardian e pelo paywall (FeatureLimit ausente
// → checkFeatureAccess permissivo). Mesma base usada no teste de paywall.
function setupEmpregadorGuardianOk(userId: string) {
  mockPrisma.user.findUnique = async () => ({
    id: userId,
    role: "EMPREGADOR",
    status: "ATIVO",
  });
  mockPrisma.documentVerification.findFirst = async () => ({
    status: "APPROVED",
    docUrl: "verificacoes/" + userId + "/frente/abc.jpg",
  });
  mockPrisma.userRestriction.findMany = async () => [];
  mockPrisma.safeScoreProfile.findUnique = async () => null;
  mockPrisma.safeScore.findUnique = async () => null;
  mockPrisma.subscription.findUnique = async () => null;
  mockPrisma.featureLimit.findUnique = async () => null; // sem limite → allowed
}

const BASE_ENDERECO = {
  dataISO: "2026-06-01T10:00:00.000Z",
  turno: "MANHA",
  cidade: "Iporá",
  uf: "GO",
  bairro: "Centro",
};

describe("POST /api/servicos — validação de tipo/profissional", () => {
  beforeEach(() => {
    resetMockPrisma();
  });

  it("tipo DIARISTA sem diaristaUserId retorna 400", async () => {
    const userId = "u-emp-1";
    setupEmpregadorGuardianOk(userId);

    let createCalled = false;
    mockPrisma.servico.create = async () => {
      createCalled = true;
      return { id: "x" };
    };

    const POST = await getPost();
    const res = await POST(
      jsonRequest(
        "http://test/api/servicos",
        { tipo: "FAXINA", categoria: "FAXINA_LEVE", ...BASE_ENDERECO },
        makeAuthHeaders(userId, "EMPREGADOR"),
      ),
    );

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.match(body.error, /diaristaUserId/i);
    assert.equal(createCalled, false);
  });

  it("tipo MONTADOR com profissional que não é montador retorna 400", async () => {
    const userId = "u-emp-2";
    setupEmpregadorGuardianOk(userId);
    // user.findUnique global devolve EMPREGADOR para qualquer id → o alvo
    // montadorUserId resolve para role != MONTADOR → "Montador inválido".

    let createCalled = false;
    mockPrisma.servico.create = async () => {
      createCalled = true;
      return { id: "x" };
    };

    const POST = await getPost();
    const res = await POST(
      jsonRequest(
        "http://test/api/servicos",
        {
          tipo: "MONTADOR",
          categoria: "MONTADOR_MONTAGEM",
          montadorUserId: "u-nao-montador",
          ...BASE_ENDERECO,
        },
        makeAuthHeaders(userId, "EMPREGADOR"),
      ),
    );

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.match(body.error, /montador/i);
    assert.equal(createCalled, false);
  });

  it("payload sem cidade retorna 400 (Dados inválidos)", async () => {
    const userId = "u-emp-3";
    setupEmpregadorGuardianOk(userId);

    const POST = await getPost();
    const res = await POST(
      jsonRequest(
        "http://test/api/servicos",
        {
          tipo: "FAXINA",
          categoria: "FAXINA_LEVE",
          dataISO: "2026-06-01T10:00:00.000Z",
          turno: "MANHA",
          uf: "GO",
          bairro: "Centro",
          diaristaUserId: "u-diarista-1",
        },
        makeAuthHeaders(userId, "EMPREGADOR"),
      ),
    );

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.match(body.error, /inválid/i);
  });
});
