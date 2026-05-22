import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { makeAuthHeaders, jsonRequest } from "./_helpers";
import { multipartRequest, JPEG_VALID } from "./_multipart";

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

describe("POST /api/incidentes — anexos com magic bytes", () => {
  // Cada teste usa userId único — bucket user é 6/10min e pode esgotar
  // se reutilizar o mesmo identificador entre múltiplos describes.
  let attachCalls = 0;

  function uniqueEmpregadorId(label: string) {
    return `u-empregador-attach-${label}-${Date.now()}`;
  }

  beforeEach(async () => {
    resetMockPrisma();
    attachCalls = 0;
    mockPrisma.incidentReport.create = async () => ({ id: "inc-attach-1", status: "ABERTO" });
    mockPrisma.incidentAttachment.create = async () => {
      attachCalls += 1;
      return { id: `att-${attachCalls}` };
    };
    const { s3 } = await import("../../src/lib/s3");
    (s3 as { send: unknown }).send = async () => ({ $metadata: {} });
  });

  it("descarta anexo com magic bytes inválidos mas cria o incidente (best-effort)", async () => {
    const userId = uniqueEmpregadorId("invalid");
    mockPrisma.servico.findUnique = async () => ({ ...SVC, clientId: userId });

    const pdf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(64, 0x00)]);
    const req = multipartRequest(
      "http://test/api/incidentes",
      [
        { kind: "field", name: "serviceId", value: "svc-1" },
        { kind: "field", name: "categoria", value: "OUTRO" },
        { kind: "field", name: "gravidade", value: "MEDIA" },
        { kind: "file", name: "files", filename: "fake.jpg", mime: "image/jpeg", data: pdf },
      ],
      { userId, role: "EMPREGADOR" },
    );
    const POST = await getPost();
    const res = await POST(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.incidentId, "inc-attach-1");
    assert.equal(attachCalls, 0, "anexo com magic bytes inválido não deve ser persistido");
  });

  it("aceita anexo JPG real (magic bytes ok) e persiste IncidentAttachment", async () => {
    const userId = uniqueEmpregadorId("valid");
    mockPrisma.servico.findUnique = async () => ({ ...SVC, clientId: userId });

    const req = multipartRequest(
      "http://test/api/incidentes",
      [
        { kind: "field", name: "serviceId", value: "svc-1" },
        { kind: "field", name: "categoria", value: "OUTRO" },
        { kind: "field", name: "gravidade", value: "MEDIA" },
        { kind: "file", name: "files", filename: "ok.jpg", mime: "image/jpeg", data: JPEG_VALID },
      ],
      { userId, role: "EMPREGADOR" },
    );
    const POST = await getPost();
    const res = await POST(req);
    assert.equal(res.status, 200);
    assert.equal(attachCalls, 1, "incidentAttachment.create deveria ter sido chamado uma vez");
  });

  it("rejeita anexo com MIME application/pdf antes mesmo dos magic bytes (filtro inicial)", async () => {
    const userId = uniqueEmpregadorId("pdf-mime");
    mockPrisma.servico.findUnique = async () => ({ ...SVC, clientId: userId });

    const req = multipartRequest(
      "http://test/api/incidentes",
      [
        { kind: "field", name: "serviceId", value: "svc-1" },
        { kind: "field", name: "categoria", value: "OUTRO" },
        { kind: "field", name: "gravidade", value: "MEDIA" },
        { kind: "file", name: "files", filename: "x.pdf", mime: "application/pdf", data: JPEG_VALID },
      ],
      { userId, role: "EMPREGADOR" },
    );
    const POST = await getPost();
    const res = await POST(req);
    assert.equal(res.status, 200);
    assert.equal(attachCalls, 0, "MIME não-image deve ser descartado, sem create de attachment");
  });
});
