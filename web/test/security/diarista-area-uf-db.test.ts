import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

/**
 * Área de atendimento da diarista: a rota real grava a UF canônica de duas
 * letras, aceita nome completo do estado por correspondência exata e recusa o
 * resto sem gravar nada (nem os outros campos do mesmo pedido).
 */
const URL_BANCO = process.env.SAFESCORE_DB_URL;
const PULAR = !URL_BANCO
  ? "defina SAFESCORE_DB_URL (Postgres local com as migrations aplicadas)"
  : !/@(localhost|127\.0\.0\.1)[:/]/.test(URL_BANCO)
    ? "SAFESCORE_DB_URL não aponta para localhost — recusado"
    : false;
const EXIGIDO = process.env.SAFESCORE_DB_REQUIRED === "1";

describe("UF da área de atendimento da diarista (DB)", { skip: EXIGIDO ? false : PULAR }, () => {
  let prisma: any;
  let patchMe: (r: Request) => Promise<Response>;
  let putBairros: (r: Request) => Promise<Response>;
  let makeAuthHeaders: (u: string, r: any) => Record<string, string>;
  const RUN = `t_ufarea_${Date.now().toString(36)}`;
  const ids: string[] = [];
  let ip = 0;

  async function diarista(sufixo: string) {
    const id = `${RUN}_${sufixo}`;
    await prisma.user.create({ data: { id, nome: sufixo, role: "DIARISTA", status: "ATIVO" } });
    await prisma.diaristaProfile.create({ data: { userId: id, precoLeve: 100, precoPesada: 200, cidade: "Água Boa", estado: "MT", bio: "antes" } });
    ids.push(id);
    return id;
  }

  const req = (url: string, metodo: string, u: string, corpo: unknown) =>
    new Request(url, {
      method: metodo,
      headers: { "content-type": "application/json", "x-forwarded-for": `10.9.0.${++ip}`, ...makeAuthHeaders(u, "DIARISTA") },
      body: JSON.stringify(corpo),
    });
  const perfil = (u: string) => prisma.diaristaProfile.findUnique({ where: { userId: u }, select: { cidade: true, estado: true, bio: true } });

  before(async () => {
    if (PULAR) throw new Error(`SAFESCORE_DB_REQUIRED=1, mas ${PULAR}`);
    process.env.DATABASE_URL = URL_BANCO;
    ({ prisma } = await import("../../src/lib/prisma"));
    patchMe = (await import("../../src/app/api/diarista/me/route")).PATCH;
    const bairros = await import("../../src/app/api/diarista/bairros/route");
    putBairros = (bairros as any).PUT ?? (bairros as any).POST;
    ({ makeAuthHeaders } = await import("./_helpers"));
  });

  after(async () => {
    if (!prisma) return;
    await prisma.diaristaBairro?.deleteMany?.({ where: { diarista: { userId: { in: ids } } } }).catch(() => undefined);
    await prisma.diaristaProfile.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  it("UF válida em minúsculas: grava a sigla canônica", async () => {
    const u = await diarista("valida");
    const r = await patchMe(req("http://test/api/diarista/me", "PATCH", u, { cidade: "Cuiabá", estado: "mt" }));
    assert.equal(r.status, 200);
    assert.deepEqual(await perfil(u), { cidade: "Cuiabá", estado: "MT", bio: "antes" });
  });

  it("nome completo do estado (cliente antigo): normalizado por correspondência exata", async () => {
    const u = await diarista("nome");
    const r = await patchMe(req("http://test/api/diarista/me", "PATCH", u, { cidade: "Campo Grande", estado: "Mato Grosso do Sul" }));
    assert.equal(r.status, 200);
    assert.equal((await perfil(u)).estado, "MS");
  });

  for (const invalida of ["Mato", "MA TO", "XX", "Maranhao do Norte"]) {
    it(`UF inválida "${invalida}": 400 e NADA gravado, nem os outros campos do pedido`, async () => {
      const u = await diarista(`inv_${invalida.replace(/\W/g, "")}`);
      const r = await patchMe(req("http://test/api/diarista/me", "PATCH", u, { cidade: "Outra", bio: "depois", estado: invalida }));
      assert.equal(r.status, 400);
      assert.deepEqual(await perfil(u), { cidade: "Água Boa", estado: "MT", bio: "antes" }, "perfil intacto");
    });
  }

  it("bairros: UF inválida recusada sem criar bairro; nome completo vira sigla no catálogo", async () => {
    const u = await diarista("bairros");
    const antes = await prisma.bairro.count();
    const ruim = await putBairros(req("http://test/api/diarista/bairros", "PUT", u, { cidade: "Água Boa", uf: "XX", bairros: [`${RUN} Centro`] }));
    assert.equal(ruim.status, 400);
    assert.equal(await prisma.bairro.count(), antes);
    const bom = await putBairros(req("http://test/api/diarista/bairros", "PUT", u, { cidade: "Água Boa", uf: "mato grosso", bairros: [`${RUN} Centro`] }));
    assert.equal(bom.status, 200);
    const criado = await prisma.bairro.findFirst({ where: { nome: `${RUN} Centro` } });
    assert.equal(criado.uf, "MT");
    await prisma.diaristaBairro.deleteMany({ where: { bairroId: criado.id } }).catch(() => undefined);
    await prisma.bairro.delete({ where: { id: criado.id } }).catch(() => undefined);
  });

  it("localização atual: região manual enviada depois da detectada não fica com a coordenada antiga", async () => {
    const { PATCH } = await import("../../src/app/api/me/localizacao/route");
    const u = await diarista("manual");
    const detectada = { latitude: -14.05, longitude: -52.16, cidade: "Água Boa", estado: "MT", bairro: "Centro", localizacaoPermitida: true };
    assert.equal((await PATCH(req("http://test/api/me/localizacao", "PATCH", u, detectada))).status, 200);
    // Corpo que o app monta depois da edição manual (payloadLocalizacaoAtual): sem coordenada.
    const manual = { latitude: null, longitude: null, cidade: "Nova Xavantina", estado: "MT", bairro: null, localizacaoPermitida: true };
    assert.equal((await PATCH(req("http://test/api/me/localizacao", "PATCH", u, manual))).status, 200);
    const gravado = await prisma.diaristaProfile.findUnique({ where: { userId: u }, select: { latitude: true, longitude: true, cidadeAtual: true, estadoAtual: true, cidade: true, estado: true } });
    assert.deepEqual(gravado, { latitude: null, longitude: null, cidadeAtual: "Nova Xavantina", estadoAtual: "MT", cidade: "Água Boa", estado: "MT" }, "sem coordenada antiga; área intacta");
  });
});
