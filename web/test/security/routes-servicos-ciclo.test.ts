import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { makeAuthHeaders, jsonRequest } from "./_helpers";

async function getDetail() {
  const mod = await import("../../src/app/api/servicos/[id]/route");
  return mod.GET;
}
async function getCancelar() {
  const mod = await import("../../src/app/api/servicos/[id]/cancelar/route");
  return mod.POST;
}
async function getAvaliar() {
  const mod = await import("../../src/app/api/servicos/[id]/avaliar/route");
  return mod.POST;
}

const DONO = "u-empregador-dono";
const OUTRO = "u-empregador-outro";
const SERVICO_ID = "svc-1";

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

// Serviço pertencente a DONO, com uma diarista vinculada.
function servicoDoDono(status = "SOLICITADO") {
  return {
    id: SERVICO_ID,
    status,
    clientId: DONO,
    diaristaId: "u-diarista-1",
    montadorId: null,
    enderecoCompleto: "Rua X, 10",
    observacoes: null,
  };
}

describe("GET /api/servicos/[id] — detalhe (IDOR)", () => {
  beforeEach(() => resetMockPrisma());

  it("retorna 401 sem token", async () => {
    const GET = await getDetail();
    const res = await GET(jsonRequest("http://test/api/servicos/svc-1", null), params(SERVICO_ID));
    assert.equal(res.status, 401);
  });

  it("retorna 403 para empregador que não participa do serviço", async () => {
    mockPrisma.servico.findUnique = async () => servicoDoDono();
    const GET = await getDetail();
    const res = await GET(
      jsonRequest("http://test/api/servicos/svc-1", null, makeAuthHeaders(OUTRO, "EMPREGADOR")),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 403);
  });

  it("dono do serviço consegue ver o detalhe (200)", async () => {
    mockPrisma.servico.findUnique = async () => servicoDoDono();
    const GET = await getDetail();
    const res = await GET(
      jsonRequest("http://test/api/servicos/svc-1", null, makeAuthHeaders(DONO, "EMPREGADOR")),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.servico.id, SERVICO_ID);
  });
});

describe("POST /api/servicos/[id]/cancelar — IDOR/status", () => {
  beforeEach(() => resetMockPrisma());

  it("retorna 401 sem token", async () => {
    const POST = await getCancelar();
    const res = await POST(
      jsonRequest("http://test/api/servicos/svc-1/cancelar", { motivo: "indisponibilidade" }),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 401);
  });

  it("retorna 403 ao cancelar serviço de outro empregador", async () => {
    mockPrisma.servico.findUnique = async () => servicoDoDono();
    const POST = await getCancelar();
    const res = await POST(
      jsonRequest(
        "http://test/api/servicos/svc-1/cancelar",
        { motivo: "indisponibilidade" },
        makeAuthHeaders(OUTRO, "EMPREGADOR"),
      ),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 403);
  });

  it("retorna 404 quando serviço não existe", async () => {
    mockPrisma.servico.findUnique = async () => null;
    const POST = await getCancelar();
    const res = await POST(
      jsonRequest(
        "http://test/api/servicos/svc-1/cancelar",
        { motivo: "indisponibilidade" },
        makeAuthHeaders(DONO, "EMPREGADOR"),
      ),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 404);
  });

  it("retorna 409 ao cancelar serviço em status não cancelável (CONCLUIDO)", async () => {
    mockPrisma.servico.findUnique = async () => servicoDoDono("CONCLUIDO");
    const POST = await getCancelar();
    const res = await POST(
      jsonRequest(
        "http://test/api/servicos/svc-1/cancelar",
        { motivo: "indisponibilidade" },
        makeAuthHeaders(DONO, "EMPREGADOR"),
      ),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 409);
  });
});

describe("POST /api/servicos/[id]/avaliar — autorização", () => {
  beforeEach(() => resetMockPrisma());

  const AVALIACAO_BODY = {
    notaGeral: 5,
    pontualidade: 5,
    qualidade: 5,
    comunicacao: 5,
  };

  it("retorna 401 sem token", async () => {
    const POST = await getAvaliar();
    const res = await POST(
      jsonRequest("http://test/api/servicos/svc-1/avaliar", AVALIACAO_BODY),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 401);
  });

  it("retorna 403 para DIARISTA (apenas empregador avalia)", async () => {
    const POST = await getAvaliar();
    const res = await POST(
      jsonRequest(
        "http://test/api/servicos/svc-1/avaliar",
        AVALIACAO_BODY,
        makeAuthHeaders("u-diarista", "DIARISTA"),
      ),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 403);
  });

  it("retorna 403 quando empregador não é dono do serviço", async () => {
    mockPrisma.servico.findUnique = async () => ({ ...servicoDoDono("CONFIRMADO"), avaliacao: null });
    const POST = await getAvaliar();
    const res = await POST(
      jsonRequest(
        "http://test/api/servicos/svc-1/avaliar",
        AVALIACAO_BODY,
        makeAuthHeaders(OUTRO, "EMPREGADOR"),
      ),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 403);
  });
});
