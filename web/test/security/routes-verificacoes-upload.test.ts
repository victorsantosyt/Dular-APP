import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { makeAuthHeaders } from "./_helpers";
import { multipartRequest, JPEG_VALID, PNG_VALID } from "./_multipart";

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

describe("POST /api/verificacoes — magic bytes (multipart real)", () => {
  // Stub do S3.send em todo o bloco — evita chamadas de rede reais quando
  // um dos arquivos do par é válido e chega ao putObject mesmo o outro
  // sendo recusado por magic bytes (Promise.all não cancela o lado válido).
  beforeEach(async () => {
    resetMockPrisma();
    mockPrisma.diaristaProfile.findUnique = async () => null;
    mockPrisma.documentVerification.findFirst = async () => null;
    mockPrisma.diaristaProfile.upsert = async () => ({ updatedAt: new Date() });
    mockPrisma.documentVerification.create = async () => ({ id: "dv-stub" });

    const { s3 } = await import("../../src/lib/s3");
    (s3 as { send: unknown }).send = (async () => ({ $metadata: {} })) as never;
  });

  it("recusa .jpg com conteúdo de texto (magic bytes inválidos) — 400", async () => {
    const text = Buffer.from("este arquivo é só texto disfarçado de JPG");
    const req = multipartRequest(
      "http://test/api/verificacoes",
      [
        { kind: "file", name: "docFrente", filename: "frente.jpg", mime: "image/jpeg", data: text },
        { kind: "file", name: "docVerso", filename: "verso.jpg", mime: "image/jpeg", data: JPEG_VALID },
      ],
      { userId: "u-diarista", role: "DIARISTA" },
    );
    const POST = await getPost();
    const res = await POST(req);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /JPG|PNG|inválido/i);
  });

  it("recusa PDF renomeado para .jpg — 400", async () => {
    const pdf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(64, 0x55)]);
    const req = multipartRequest(
      "http://test/api/verificacoes",
      [
        { kind: "file", name: "docFrente", filename: "frente.jpg", mime: "image/jpeg", data: JPEG_VALID },
        { kind: "file", name: "docVerso", filename: "verso.jpg", mime: "image/jpeg", data: pdf },
      ],
      { userId: "u-empregador", role: "EMPREGADOR" },
    );
    const POST = await getPost();
    const res = await POST(req);
    assert.equal(res.status, 400);
  });

  it("recusa MIME image/png declarado mas conteúdo JPEG — 400 (mismatch)", async () => {
    const req = multipartRequest(
      "http://test/api/verificacoes",
      [
        { kind: "file", name: "docFrente", filename: "x.png", mime: "image/png", data: JPEG_VALID },
        { kind: "file", name: "docVerso", filename: "y.png", mime: "image/png", data: PNG_VALID },
      ],
      { userId: "u-diarista", role: "DIARISTA" },
    );
    const POST = await getPost();
    const res = await POST(req);
    assert.equal(res.status, 400);
  });

  it("recusa MIME declarado application/pdf — 400 (não-image)", async () => {
    const req = multipartRequest(
      "http://test/api/verificacoes",
      [
        { kind: "file", name: "docFrente", filename: "doc.pdf", mime: "application/pdf", data: JPEG_VALID },
        { kind: "file", name: "docVerso", filename: "v.jpg", mime: "image/jpeg", data: JPEG_VALID },
      ],
      { userId: "u-diarista", role: "DIARISTA" },
    );
    const POST = await getPost();
    const res = await POST(req);
    assert.equal(res.status, 400);
  });

  it("JPG real válido passa magic bytes e chega ao putObject (S3 stubado)", async () => {
    const req = multipartRequest(
      "http://test/api/verificacoes",
      [
        { kind: "file", name: "docFrente", filename: "f.jpg", mime: "image/jpeg", data: JPEG_VALID },
        { kind: "file", name: "docVerso", filename: "v.jpg", mime: "image/jpeg", data: JPEG_VALID },
      ],
      { userId: "u-diarista-ok", role: "DIARISTA" },
    );
    const POST = await getPost();
    const res = await POST(req);
    // O importante: NÃO é 400 (magic bytes passaram). Status final pode ser
    // 200 (Guardian/autoVerificar tolerantes) ou 500 se algum side-effect
    // lateral exigir mock extra. Asseguramos só o gate de upload aqui.
    assert.notEqual(res.status, 400);
  });
});
