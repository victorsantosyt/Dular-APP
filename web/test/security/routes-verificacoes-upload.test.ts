import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { makeAuthHeaders } from "./_helpers";

// Nota: testes de rota completa para upload multipart (validação real de magic
// bytes via parseMultipart) ficaram pendentes — formidable não consome o
// stream gerado por Readable.fromWeb(FormData) sem hack adicional de
// content-length/boundary. A lógica de magic bytes está coberta por
// imageMagicBytes.test.ts (unit). Aqui cobrimos apenas o caminho de
// autorização, anterior ao parseMultipart.

async function getPost() {
  const mod = await import("../../src/app/api/verificacoes/route");
  return mod.POST;
}

const FAKE_JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

describe("POST /api/verificacoes — autorização", () => {
  beforeEach(() => {
    resetMockPrisma();
    mockPrisma.diaristaProfile.findUnique = async () => null;
    mockPrisma.documentVerification.findFirst = async () => null;
  });

  it("retorna 401 sem token", async () => {
    const req = new Request("http://test/api/verificacoes", { method: "POST" });
    const POST = await getPost();
    const res = await POST(req);
    assert.equal(res.status, 401);
  });

  it("retorna 403 para role não suportado (ADMIN)", async () => {
    const fd = new FormData();
    fd.append("docFrente", new Blob([FAKE_JPEG_HEADER], { type: "image/jpeg" }), "f.jpg");
    fd.append("docVerso", new Blob([FAKE_JPEG_HEADER], { type: "image/jpeg" }), "v.jpg");
    const req = new Request("http://test/api/verificacoes", {
      method: "POST",
      headers: makeAuthHeaders("u-admin", "ADMIN"),
      body: fd,
    });
    const POST = await getPost();
    const res = await POST(req);
    assert.equal(res.status, 403);
  });

  it("retorna 409 para DIARISTA com verificação já APROVADA (anti-resubmit)", async () => {
    mockPrisma.diaristaProfile.findUnique = async () => ({
      verificacao: "VERIFICADO",
      docUrl: "verificacoes/abc/frente/x.jpg",
    });
    const req = new Request("http://test/api/verificacoes", {
      method: "POST",
      headers: makeAuthHeaders("u-diarista", "DIARISTA"),
      body: new FormData(),
    });
    const POST = await getPost();
    const res = await POST(req);
    assert.equal(res.status, 409);
  });

  it("retorna 409 para EMPREGADOR com verificação PENDING ativa", async () => {
    mockPrisma.documentVerification.findFirst = async () => ({
      status: "PENDING",
      docUrl: '{"frente":"x.jpg","verso":"y.jpg"}',
    });
    const req = new Request("http://test/api/verificacoes", {
      method: "POST",
      headers: makeAuthHeaders("u-empregador", "EMPREGADOR"),
      body: new FormData(),
    });
    const POST = await getPost();
    const res = await POST(req);
    assert.equal(res.status, 409);
  });
});
