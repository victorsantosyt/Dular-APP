import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { makeAuthHeaders, jsonRequest } from "./_helpers";

async function getPost() {
  const mod = await import("../../src/app/api/servicos/route");
  return mod.POST;
}

// Configura mocks de Prisma necessários para que um EMPREGADOR ATIVO
// passe pelo SafeScore Guardian (`assertGuardianCanCreateServico`) e chegue
// ao gate de paywall (`checkFeatureAccess`). Não toca em featureLimit nem
// subscription — cada teste configura esses dois para exercitar o paywall.
function setupEmpregadorGuardianOk(userId: string) {
  mockPrisma.user.findUnique = async () => ({
    id: userId,
    role: "EMPREGADOR",
    status: "ATIVO",
  });
  // VERIFICADO (DocumentVerification mais recente com docUrl).
  mockPrisma.documentVerification.findFirst = async () => ({
    status: "APPROVED",
    docUrl: "verificacoes/" + userId + "/frente/abc.jpg",
  });
  mockPrisma.userRestriction.findMany = async () => [];
  // SafeScoreProfile ausente → cai no legacy → ausente → default 500 BRONZE.
  mockPrisma.safeScoreProfile.findUnique = async () => null;
  mockPrisma.safeScore.findUnique = async () => null;
}

// Body mínimo válido para a rota — não chega a ser usado quando paywall bloqueia
// (validação do body acontece DEPOIS do paywall em servicos/route.ts:118).
const SERVICO_BODY = {
  tipo: "FAXINA",
  categoria: "FAXINA_LEVE",
  dataISO: "2026-06-01T10:00:00.000Z",
  turno: "MANHA",
  cidade: "São Paulo",
  uf: "SP",
  bairro: "Vila Mariana",
  diaristaUserId: "u-diarista-existente",
};

describe("POST /api/servicos — paywall server-side", () => {
  beforeEach(() => {
    resetMockPrisma();
  });

  it("retorna 401 sem token", async () => {
    const POST = await getPost();
    const res = await POST(
      jsonRequest("http://test/api/servicos", SERVICO_BODY),
    );
    assert.equal(res.status, 401);
  });

  it("retorna 403 quando DIARISTA tenta criar serviço (role inválido)", async () => {
    const POST = await getPost();
    const res = await POST(
      jsonRequest(
        "http://test/api/servicos",
        SERVICO_BODY,
        makeAuthHeaders("u-diarista", "DIARISTA"),
      ),
    );
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.match(body.error, /empregador/i);
  });

  it("retorna 403 quando MONTADOR tenta criar serviço (role inválido)", async () => {
    const POST = await getPost();
    const res = await POST(
      jsonRequest(
        "http://test/api/servicos",
        SERVICO_BODY,
        makeAuthHeaders("u-montador", "MONTADOR"),
      ),
    );
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.ok, false);
  });

  it("ADMIN também é bloqueado (apenas EMPREGADOR pode criar) — comportamento atual da rota", async () => {
    // Documenta o contrato real: a rota /api/servicos exige role EMPREGADOR
    // estritamente. Admin não é tratado como "bypass de paywall" aqui — para
    // operações administrativas, há endpoints próprios sob /api/admin/*.
    const POST = await getPost();
    const res = await POST(
      jsonRequest(
        "http://test/api/servicos",
        SERVICO_BODY,
        makeAuthHeaders("u-admin", "ADMIN"),
      ),
    );
    assert.equal(res.status, 403);
  });

  it("retorna 403 LIMIT_EXCEEDED quando EMPREGADOR atinge limite do plano", async () => {
    const userId = "u-empregador-blocked";
    setupEmpregadorGuardianOk(userId);

    // FREE tier sem subscription ativa.
    mockPrisma.subscription.findUnique = async () => null;
    // Limite definido: 3 solicitações por mês, enabled.
    mockPrisma.featureLimit.findUnique = async () => ({ limit: 3, enabled: true });
    // Já consumiu 3 (igual ao limite → bloqueia).
    mockPrisma.servico.count = async () => 3;

    // create não deve ser chamado — assertiva crítica.
    let createCalled = false;
    mockPrisma.servico.create = async () => {
      createCalled = true;
      return { id: "should-not-create" };
    };

    const POST = await getPost();
    const res = await POST(
      jsonRequest(
        "http://test/api/servicos",
        SERVICO_BODY,
        makeAuthHeaders(userId, "EMPREGADOR"),
      ),
    );

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.error, "LIMIT_EXCEEDED");
    assert.equal(body.feature, "SOLICITACOES_MES");
    assert.equal(body.plan, "FREE");
    assert.equal(body.usage.used, 3);
    assert.equal(body.usage.limit, 3);
    assert.equal(typeof body.message, "string");
    assert.ok(body.message.length > 0);
    assert.equal(createCalled, false, "servico.create não deve ser chamado quando paywall bloqueia");
  });

  it("retorna 403 LIMIT_EXCEEDED quando feature está DESABILITADA para o plano", async () => {
    const userId = "u-empregador-feature-off";
    setupEmpregadorGuardianOk(userId);
    mockPrisma.subscription.findUnique = async () => null;
    // enabled=false → bloqueia independentemente do used.
    mockPrisma.featureLimit.findUnique = async () => ({ limit: 3, enabled: false });
    mockPrisma.servico.count = async () => 0;

    let createCalled = false;
    mockPrisma.servico.create = async () => {
      createCalled = true;
      return { id: "x" };
    };

    const POST = await getPost();
    const res = await POST(
      jsonRequest(
        "http://test/api/servicos",
        SERVICO_BODY,
        makeAuthHeaders(userId, "EMPREGADOR"),
      ),
    );

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error, "LIMIT_EXCEEDED");
    assert.equal(createCalled, false);
  });

  it("EMPREGADOR sob limite NÃO é bloqueado pelo paywall (chega ao fluxo de validação)", async () => {
    // O ponto desta asserção é: paywall PASSA. O fluxo subsequente pode
    // falhar por outros motivos (bairro/diarista mockados de forma parcial),
    // mas a resposta NÃO deve ser LIMIT_EXCEEDED.
    const userId = "u-empregador-ok";
    setupEmpregadorGuardianOk(userId);
    mockPrisma.subscription.findUnique = async () => null;
    mockPrisma.featureLimit.findUnique = async () => ({ limit: 5, enabled: true });
    mockPrisma.servico.count = async () => 2; // 2 < 5 → allowed
    // Resto do fluxo: força bairro inexistente para parar em 400 (não-paywall).
    mockPrisma.bairro.findUnique = async () => null;

    let createCalled = false;
    mockPrisma.servico.create = async () => {
      createCalled = true;
      return { id: "x" };
    };

    const POST = await getPost();
    const res = await POST(
      jsonRequest(
        "http://test/api/servicos",
        SERVICO_BODY,
        makeAuthHeaders(userId, "EMPREGADOR"),
      ),
    );

    // Não é 403 LIMIT_EXCEEDED — paywall passou.
    if (res.status === 403) {
      const body = await res.json();
      assert.notEqual(body.error, "LIMIT_EXCEEDED", "paywall não deveria bloquear");
    }
    // Outras validações subsequentes podem falhar com 400 (diarista inválido,
    // bairro inexistente, etc.) — o que importa é que o fluxo passou do paywall.
    assert.equal(createCalled, false, "diarista mockada como inválida — create não deve rodar");
  });

  it("EMPREGADOR sem FeatureLimit configurado para o plano NÃO é bloqueado (default permissivo)", async () => {
    const userId = "u-empregador-sem-limit";
    setupEmpregadorGuardianOk(userId);
    mockPrisma.subscription.findUnique = async () => null;
    // FeatureLimit ausente → checkFeatureAccess retorna { allowed: true }.
    mockPrisma.featureLimit.findUnique = async () => null;
    mockPrisma.bairro.findUnique = async () => null; // força 400 não-paywall

    const POST = await getPost();
    const res = await POST(
      jsonRequest(
        "http://test/api/servicos",
        SERVICO_BODY,
        makeAuthHeaders(userId, "EMPREGADOR"),
      ),
    );

    if (res.status === 403) {
      const body = await res.json();
      assert.notEqual(body.error, "LIMIT_EXCEEDED");
    }
  });

  it("plano ACTIVE PREMIUM com limite ilimitado (null) NÃO é bloqueado", async () => {
    const userId = "u-premium";
    setupEmpregadorGuardianOk(userId);
    mockPrisma.subscription.findUnique = async () => ({
      plan: "PREMIUM",
      status: "ACTIVE",
    });
    mockPrisma.featureLimit.findUnique = async () => ({ limit: null, enabled: true });
    mockPrisma.servico.count = async () => 99999;
    mockPrisma.bairro.findUnique = async () => null;

    const POST = await getPost();
    const res = await POST(
      jsonRequest(
        "http://test/api/servicos",
        SERVICO_BODY,
        makeAuthHeaders(userId, "EMPREGADOR"),
      ),
    );

    if (res.status === 403) {
      const body = await res.json();
      assert.notEqual(body.error, "LIMIT_EXCEEDED");
    }
  });

  it("subscription CANCELED é tratada como FREE (ativa o limite do FREE)", async () => {
    const userId = "u-canceled";
    setupEmpregadorGuardianOk(userId);
    mockPrisma.subscription.findUnique = async () => ({
      plan: "PREMIUM",
      status: "CANCELED",
    });
    // Limite FREE atingido.
    mockPrisma.featureLimit.findUnique = async () => ({ limit: 1, enabled: true });
    mockPrisma.servico.count = async () => 1;

    let createCalled = false;
    mockPrisma.servico.create = async () => {
      createCalled = true;
      return { id: "x" };
    };

    const POST = await getPost();
    const res = await POST(
      jsonRequest(
        "http://test/api/servicos",
        SERVICO_BODY,
        makeAuthHeaders(userId, "EMPREGADOR"),
      ),
    );

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error, "LIMIT_EXCEEDED");
    assert.equal(body.plan, "FREE", "status CANCELED deve cair para FREE");
    assert.equal(createCalled, false);
  });
});
