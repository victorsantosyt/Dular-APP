import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { makeAuthHeaders, jsonRequest } from "./_helpers";

async function getPost() {
  const mod = await import("../../src/app/api/incidentes/route");
  return mod.POST;
}

const SVC = {
  clientId: "u-empregador",
  diaristaId: "u-diarista",
  montadorId: null,
};

describe("POST /api/incidentes", () => {
  beforeEach(() => {
    resetMockPrisma();
  });

  it("retorna 401 sem token", async () => {
    const POST = await getPost();
    const res = await POST(
      jsonRequest("http://test/api/incidentes", { serviceId: "svc-1" }),
    );
    assert.equal(res.status, 401);
  });

  it("retorna 403 quando usuário não é participante do serviço (IDOR)", async () => {
    mockPrisma.servico.findUnique = async () => SVC;
    const POST = await getPost();
    const res = await POST(
      jsonRequest(
        "http://test/api/incidentes",
        { serviceId: "svc-1" },
        makeAuthHeaders("u-outsider", "EMPREGADOR"),
      ),
    );
    assert.equal(res.status, 403);
  });

  it("retorna 403 quando reportedUserId não é uma contraparte real do serviço", async () => {
    mockPrisma.servico.findUnique = async () => SVC;
    const POST = await getPost();
    const res = await POST(
      jsonRequest(
        "http://test/api/incidentes",
        { serviceId: "svc-1", reportedUserId: "u-random-other" },
        makeAuthHeaders("u-empregador", "EMPREGADOR"),
      ),
    );
    assert.equal(res.status, 403);
  });

  it("retorna 400 quando serviceId não é informado", async () => {
    const POST = await getPost();
    const res = await POST(
      jsonRequest(
        "http://test/api/incidentes",
        { descricao: "algo" },
        makeAuthHeaders("u-empregador", "EMPREGADOR"),
      ),
    );
    assert.equal(res.status, 400);
  });

  it("retorna 403 quando o serviço não existe", async () => {
    mockPrisma.servico.findUnique = async () => null;
    const POST = await getPost();
    const res = await POST(
      jsonRequest(
        "http://test/api/incidentes",
        { serviceId: "svc-inexistente" },
        makeAuthHeaders("u-empregador", "EMPREGADOR"),
      ),
    );
    assert.equal(res.status, 403);
  });

  it("permite empregador reportar contraparte legítima (diarista do mesmo serviço)", async () => {
    mockPrisma.servico.findUnique = async () => SVC;
    mockPrisma.incidentReport.create = async () => ({
      id: "inc-1",
      status: "ABERTO",
    });

    const POST = await getPost();
    const res = await POST(
      jsonRequest(
        "http://test/api/incidentes",
        {
          serviceId: "svc-1",
          reportedUserId: "u-diarista",
          categoria: "OUTRO",
          gravidade: "MEDIA",
        },
        makeAuthHeaders("u-empregador", "EMPREGADOR"),
      ),
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.incidentId, "inc-1");
  });

  it("permite diarista reportar o empregador (contraparte default)", async () => {
    mockPrisma.servico.findUnique = async () => SVC;
    mockPrisma.incidentReport.create = async () => ({
      id: "inc-2",
      status: "ABERTO",
    });

    const POST = await getPost();
    const res = await POST(
      jsonRequest(
        "http://test/api/incidentes",
        { serviceId: "svc-1", categoria: "OUTRO", gravidade: "MEDIA" },
        makeAuthHeaders("u-diarista", "DIARISTA"),
      ),
    );
    assert.equal(res.status, 200);
  });
});
