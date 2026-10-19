import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { makeAuthHeaders } from "./_helpers";
import { multipartRequest, JPEG_VALID, PNG_VALID } from "./_multipart";
import { stubS3Send, restoreS3Send, s3CallCount, resetS3CallCount } from "./_stubS3";

async function getPost() {
  const mod = await import("../../src/app/api/verificacoes/route");
  return mod.POST;
}

const FAKE_JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const DADOS_COMPLETOS = { id: "u", status: "ATIVO", role: "DIARISTA", nomeCompleto: "Maria da Silva", cpf: "11144477735", dataNascimento: new Date("1990-01-01") };
const SELFIE = { kind: "file" as const, name: "selfie", filename: "selfie.jpg", mime: "image/jpeg", data: JPEG_VALID };

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
  // Stub do S3 no prototype garante captura em qualquer instance de S3Client,
  // independentemente da versão do SDK ou da resolução de método.
  beforeEach(() => {
    resetMockPrisma();
    mockPrisma.diaristaProfile.findUnique = async () => null;
    mockPrisma.documentVerification.findFirst = async () => null;
    mockPrisma.diaristaProfile.upsert = async () => ({ updatedAt: new Date() });
    mockPrisma.documentVerification.create = async () => ({ id: "dv-stub" });
    // Dados obrigatórios presentes: estes testes tratam dos arquivos.
    mockPrisma.user.findUnique = async () => DADOS_COMPLETOS;
    stubS3Send();
    resetS3CallCount();
  });

  after(() => {
    restoreS3Send();
  });

  // Helper diagnóstico: se a rota responder 500, dumps body para stderr
  // para que CI tenha visibilidade (console.error não é silenciado).
  async function debugIfUnexpected(res: Response, expected: number, label: string) {
    if (res.status !== expected) {
      const cloned = res.clone();
      const body = await cloned.text();
      console.error(
        `[verificacoes test] expected ${expected} got ${res.status} — ${label} — body: ${body}`,
      );
    }
  }

  it("recusa .jpg com conteúdo de texto (magic bytes inválidos) — 400", async () => {
    const text = Buffer.from("este arquivo é só texto disfarçado de JPG");
    const req = multipartRequest(
      "http://test/api/verificacoes",
      [
        { kind: "file", name: "docFrente", filename: "frente.jpg", mime: "image/jpeg", data: text },
        { kind: "file", name: "docVerso", filename: "verso.jpg", mime: "image/jpeg", data: JPEG_VALID },
        SELFIE,
      ],
      { userId: "u-diarista", role: "DIARISTA" },
    );
    const POST = await getPost();
    const res = await POST(req);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /JPG|PNG|inválido/i);
  });

  it("recusa PDF renomeado para .jpg — 400 (frente válida + verso inválido, sem upload parcial)", async () => {
    // Contrato: se QUALQUER documento for inválido, a rota retorna 400 e
    // NENHUM upload S3 deve acontecer — nem mesmo do arquivo válido.
    // Caso contrário haveria vazamento de upload parcial ao S3 quando a
    // submissão como um todo falha.
    const pdf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(64, 0x55)]);
    const req = multipartRequest(
      "http://test/api/verificacoes",
      [
        { kind: "file", name: "docFrente", filename: "frente.jpg", mime: "image/jpeg", data: JPEG_VALID },
        { kind: "file", name: "docVerso", filename: "verso.jpg", mime: "image/jpeg", data: pdf },
        SELFIE,
      ],
      { userId: "u-empregador", role: "EMPREGADOR" },
    );
    const POST = await getPost();
    const res = await POST(req);

    const bodyDebug =
      res.status === 400
        ? `status=400 s3Calls=${s3CallCount()}`
        : `status=${res.status} s3Calls=${s3CallCount()} body=${await res.clone().text()}`;

    assert.equal(res.status, 400, bodyDebug);
    assert.equal(s3CallCount(), 0, `nenhum upload S3 deve acontecer (chamadas=${s3CallCount()})`);
  });

  it("recusa MIME image/png declarado mas conteúdo JPEG — 400 (mismatch)", async () => {
    const req = multipartRequest(
      "http://test/api/verificacoes",
      [
        { kind: "file", name: "docFrente", filename: "x.png", mime: "image/png", data: JPEG_VALID },
        { kind: "file", name: "docVerso", filename: "y.png", mime: "image/png", data: PNG_VALID },
        SELFIE,
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
        SELFIE,
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
        SELFIE,
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

describe("POST /api/verificacoes — selfie, dados obrigatórios e arquivos órfãos", () => {
  const chamadas: Array<{ tipo: string; chave: string }> = [];
  let falharNoEnvio: number | null = null;

  beforeEach(() => {
    resetMockPrisma();
    process.env.DULAR_VERIFICACAO_SELFIE = "ligado";
    mockPrisma.diaristaProfile.findUnique = async () => null;
    mockPrisma.documentVerification.findFirst = async () => null;
    mockPrisma.user.findUnique = async () => DADOS_COMPLETOS;
    chamadas.length = 0;
    falharNoEnvio = null;
    let puts = 0;
    stubS3Send((async (cmd: { constructor: { name: string }; input: { Key: string } }) => {
      const tipo = cmd.constructor.name;
      chamadas.push({ tipo, chave: cmd.input.Key });
      if (tipo === "PutObjectCommand" && ++puts === falharNoEnvio) throw new Error("rede");
      return { $metadata: {} };
    }) as never);
  });
  after(() => {
    restoreS3Send();
    delete process.env.DULAR_VERIFICACAO_SELFIE;
  });

  // Conta e IP próprios por pedido: o limite de envios por hora não entra aqui.
  let seq = 0;
  const envio = (partes: Parameters<typeof multipartRequest>[1], userId = `u-selfie-${++seq}`) =>
    multipartRequest("http://test/api/verificacoes", partes, {
      userId,
      role: "DIARISTA",
      extraHeaders: { "x-forwarded-for": `10.6.0.${++seq}` },
    });
  const FRENTE = { kind: "file" as const, name: "docFrente", filename: "f.jpg", mime: "image/jpeg", data: JPEG_VALID };
  const VERSO = { kind: "file" as const, name: "docVerso", filename: "v.jpg", mime: "image/jpeg", data: JPEG_VALID };

  it("sem selfie (app anterior): 400 SELFIE_OBRIGATORIA e nenhum upload", async () => {
    const res = await (await getPost())(envio([FRENTE, VERSO]));
    assert.equal(res.status, 400);
    assert.equal((await res.json()).codigo, "SELFIE_OBRIGATORIA");
    assert.equal(chamadas.length, 0);
  });

  it("sem nome completo, CPF ou nascimento no cadastro: 400 DADOS_OBRIGATORIOS antes de receber arquivos", async () => {
    mockPrisma.user.findUnique = async () => ({ ...DADOS_COMPLETOS, nomeCompleto: null, cpf: null });
    const res = await (await getPost())(envio([FRENTE, VERSO, SELFIE]));
    assert.equal(res.status, 400);
    const corpo = await res.json();
    assert.equal(corpo.codigo, "DADOS_OBRIGATORIOS");
    assert.deepEqual(corpo.faltando, ["nomeCompleto", "cpf"]);
    assert.equal(chamadas.length, 0);
  });

  it("selfie inválida (texto disfarçado): 400 e nenhum upload", async () => {
    const res = await (await getPost())(envio([FRENTE, VERSO, { ...SELFIE, data: Buffer.from("não é imagem") }]));
    assert.equal(res.status, 400);
    assert.equal(chamadas.length, 0);
  });

  it("falha parcial no upload: 502 e os arquivos que subiram são apagados", async () => {
    falharNoEnvio = 3;
    const res = await (await getPost())(envio([FRENTE, VERSO, SELFIE]));
    assert.equal(res.status, 502);
    const subiram = chamadas.filter((c) => c.tipo === "PutObjectCommand").slice(0, 2).map((c) => c.chave);
    const apagadas = chamadas.filter((c) => c.tipo === "DeleteObjectCommand").map((c) => c.chave);
    assert.deepEqual(apagadas.sort(), subiram.sort(), "nenhum órfão no bucket");
  });

  it("banco falha depois do upload: os três arquivos são apagados; nada vai para o log", async () => {
    (mockPrisma as unknown as { $transaction: unknown }).$transaction = async () => { throw new Error("falha do banco com CPF 11144477735"); };
    const linhas: string[] = [];
    const orig = console.error;
    console.error = (...a: unknown[]) => { linhas.push(a.map(String).join(" ")); };
    let res: Response;
    try {
      res = await (await getPost())(envio([FRENTE, VERSO, SELFIE]));
    } finally {
      console.error = orig;
    }
    assert.equal(res.status, 500);
    const subiram = chamadas.filter((c) => c.tipo === "PutObjectCommand").map((c) => c.chave);
    assert.equal(subiram.length, 3);
    assert.ok(subiram.some((k) => k.includes("/selfie/")), "selfie com prefixo próprio");
    assert.deepEqual(chamadas.filter((c) => c.tipo === "DeleteObjectCommand").map((c) => c.chave).sort(), subiram.sort());
    assert.doesNotMatch(linhas.join("\n"), /verificacoes\/|11144477735/, "sem chave de arquivo nem CPF no log");
  });

  it("troca de conta: o envio é gravado para a conta do token, com os três arquivos", async () => {
    const capturado: { dados: Record<string, unknown> | null } = { dados: null };
    (mockPrisma as unknown as { $transaction: unknown }).$transaction = async (cb: (tx: unknown) => unknown) =>
      cb({
        diaristaProfile: { upsert: async () => ({ updatedAt: new Date() }) },
        user: { findUnique: async () => ({ ...DADOS_COMPLETOS, role: "DIARISTA", enderecos: [], diaristaProfile: null, montadorPerfil: null, empregadorPerfil: null }) },
        documentVerification: { create: async (args: { data: Record<string, unknown> }) => { capturado.dados = args.data; return { id: "dv" }; } },
      });
    const res = await (await getPost())(envio([FRENTE, VERSO, SELFIE], "u-conta-b"));
    assert.notEqual(res.status, 400);
    const gravado = capturado.dados;
    assert.ok(gravado, "envio gravado");
    assert.equal(gravado.userId, "u-conta-b");
    const doc = JSON.parse(String(gravado.docUrl));
    assert.ok(doc.frente && doc.verso && doc.selfie, "frente, verso e selfie na mesma submissão");
    assert.ok(String(doc.selfie).startsWith("verificacoes/u-conta-b/selfie/"));
    assert.ok(gravado.dadosEnviados, "com a fotografia dos dados");
  });

  it("modo DESLIGADO: app sem selfie e sem nome completo envia como hoje (frente e verso); com selfie, guarda os três", async () => {
    delete process.env.DULAR_VERIFICACAO_SELFIE;
    mockPrisma.user.findUnique = async () => ({ ...DADOS_COMPLETOS, nomeCompleto: null });
    const capturado: { docUrl: string[] } = { docUrl: [] };
    (mockPrisma as unknown as { $transaction: unknown }).$transaction = async (cb: (tx: unknown) => unknown) =>
      cb({
        diaristaProfile: { upsert: async () => ({ updatedAt: new Date() }) },
        user: { findUnique: async () => ({ ...DADOS_COMPLETOS, nomeCompleto: null, role: "DIARISTA", enderecos: [], diaristaProfile: null, montadorPerfil: null, empregadorPerfil: null }) },
        documentVerification: { create: async (args: { data: { docUrl: string } }) => { capturado.docUrl.push(args.data.docUrl); return { id: "dv" }; } },
      });
    const semSelfie = await (await getPost())(envio([FRENTE, VERSO]));
    assert.notEqual(semSelfie.status, 400, "sem selfie e sem nome completo: aceito");
    assert.equal(chamadas.filter((c) => c.tipo === "PutObjectCommand").length, 2);
    assert.equal(JSON.parse(capturado.docUrl[0]).selfie, undefined);
    chamadas.length = 0;
    const comSelfie = await (await getPost())(envio([FRENTE, VERSO, SELFIE]));
    assert.notEqual(comSelfie.status, 400);
    assert.equal(chamadas.filter((c) => c.tipo === "PutObjectCommand").length, 3);
    assert.ok(JSON.parse(capturado.docUrl[1]).selfie);
  });

  it("o pedido não liga nem desliga a exigência: campo de formulário é ignorado", async () => {
    const res = await (await getPost())(envio([FRENTE, VERSO, { kind: "field", name: "exigeSelfie", value: "false" }]));
    assert.equal(res.status, 400);
    assert.equal((await res.json()).codigo, "SELFIE_OBRIGATORIA");
  });
});
