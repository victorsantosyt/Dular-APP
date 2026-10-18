import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

/**
 * /api/me/sincronizacao: a versão muda quando muda dado compartilhado da conta
 * (verificação aprovada/reprovada no painel, perfil, SafeScore, assinatura,
 * restrição) e NÃO muda com o batimento de presença. Cada resposta diz de que
 * conta é.
 */
const URL_BANCO = process.env.SAFESCORE_DB_URL;
const PULAR = !URL_BANCO
  ? "defina SAFESCORE_DB_URL (Postgres local com as migrations aplicadas)"
  : !/@(localhost|127\.0\.0\.1)[:/]/.test(URL_BANCO)
    ? "SAFESCORE_DB_URL não aponta para localhost — recusado"
    : false;
const EXIGIDO = process.env.SAFESCORE_DB_REQUIRED === "1";

describe("versão de sincronização da conta (DB)", { skip: EXIGIDO ? false : PULAR }, () => {
  let prisma: any;
  let GET: (r: Request) => Promise<Response>;
  let makeAuthHeaders: (u: string, r: any) => Record<string, string>;
  const RUN = `t_sinc_${Date.now().toString(36)}`;
  const ids: string[] = [];

  before(async () => {
    if (PULAR) throw new Error(`SAFESCORE_DB_REQUIRED=1, mas ${PULAR}`);
    process.env.DATABASE_URL = URL_BANCO;
    ({ prisma } = await import("../../src/lib/prisma"));
    GET = (await import("../../src/app/api/me/sincronizacao/route")).GET;
    ({ makeAuthHeaders } = await import("./_helpers"));
  });

  after(async () => {
    if (!prisma) return;
    await prisma.documentVerification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.diaristaProfile.deleteMany({ where: { userId: { in: ids } } });
    await prisma.montadorPerfil.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  async function usuario(sufixo: string, role: string) {
    const id = `${RUN}_${sufixo}`;
    await prisma.user.create({ data: { id, nome: `Teste ${sufixo}`, role } });
    ids.push(id);
    return id;
  }
  const versao = async (userId: string, role: string) => {
    const r = await GET(new Request("http://test/api/me/sincronizacao", { headers: makeAuthHeaders(userId, role) }));
    assert.equal(r.status, 200);
    const corpo = await r.json();
    assert.equal(corpo.userId, userId, "a resposta diz de que conta é");
    return corpo.versao as string;
  };

  it("Profissional de Casa: envio, aprovação e reprovação mudam a versão; presença não", async () => {
    const u = await usuario("diarista", "DIARISTA");
    await prisma.diaristaProfile.create({ data: { userId: u, precoLeve: 100, precoPesada: 200 } });
    const v0 = await versao(u, "DIARISTA");
    await prisma.user.update({ where: { id: u }, data: { nome: "Teste diarista (presença)" } });
    assert.equal(await versao(u, "DIARISTA"), v0, "mudança fora dos dados sincronizados não muda a versão");

    await prisma.diaristaProfile.update({ where: { userId: u }, data: { docUrl: "{\"frente\":\"x\"}" } });
    const doc = await prisma.documentVerification.create({ data: { userId: u, docType: "KYC_DOCS", docUrl: "{}" } });
    const v1 = await versao(u, "DIARISTA");
    assert.notEqual(v1, v0, "envio");

    await prisma.documentVerification.update({ where: { id: doc.id }, data: { status: "APPROVED" } });
    await prisma.diaristaProfile.update({ where: { userId: u }, data: { verificacao: "VERIFICADO" } });
    const v2 = await versao(u, "DIARISTA");
    assert.notEqual(v2, v1, "aprovação no painel");

    await prisma.documentVerification.update({ where: { id: doc.id }, data: { status: "REJECTED" } });
    await prisma.diaristaProfile.update({ where: { userId: u }, data: { verificacao: "REPROVADO" } });
    assert.notEqual(await versao(u, "DIARISTA"), v2, "reprovação no painel");
  });

  it("Montador e Empregador: aprovação muda a versão", async () => {
    const m = await usuario("montador", "MONTADOR");
    await prisma.montadorPerfil.create({ data: { userId: m, especialidades: [], bairros: [], portfolioFotos: [] } });
    const vm = await versao(m, "MONTADOR");
    await prisma.montadorPerfil.update({ where: { userId: m }, data: { verificado: true } });
    assert.notEqual(await versao(m, "MONTADOR"), vm);

    const e = await usuario("empregador", "EMPREGADOR");
    const doc = await prisma.documentVerification.create({ data: { userId: e, docType: "KYC_DOCS", docUrl: "{}" } });
    const ve = await versao(e, "EMPREGADOR");
    await prisma.documentVerification.update({ where: { id: doc.id }, data: { status: "APPROVED" } });
    assert.notEqual(await versao(e, "EMPREGADOR"), ve);
  });

  it("sem sessão: 401", async () => {
    const r = await GET(new Request("http://test/api/me/sincronizacao"));
    assert.equal(r.status, 401);
  });
});
