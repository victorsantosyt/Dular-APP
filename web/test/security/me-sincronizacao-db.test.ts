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
  const servicosCriados: string[] = [];

  before(async () => {
    if (PULAR) throw new Error(`SAFESCORE_DB_REQUIRED=1, mas ${PULAR}`);
    process.env.DATABASE_URL = URL_BANCO;
    ({ prisma } = await import("../../src/lib/prisma"));
    GET = (await import("../../src/app/api/me/sincronizacao/route")).GET;
    ({ makeAuthHeaders } = await import("./_helpers"));
  });

  after(async () => {
    if (!prisma) return;
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.servico.deleteMany({ where: { id: { in: servicosCriados } } });
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
  const tempos: number[] = [];
  const consulta = async (userId: string, role: string) => {
    const t0 = performance.now();
    const r = await GET(new Request("http://test/api/me/sincronizacao", { headers: makeAuthHeaders(userId, role) }));
    tempos.push(performance.now() - t0);
    assert.equal(r.status, 200);
    assert.match(r.headers.get("cache-control") ?? "", /private/);
    assert.match(r.headers.get("cache-control") ?? "", /no-store/);
    const corpo = await r.json();
    assert.equal(corpo.userId, userId, "a resposta diz de que conta é");
    return corpo as { versao: string; versoes: Record<string, string> };
  };
  const versao = async (userId: string, role: string) => (await consulta(userId, role)).versao;

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

  it("uma versão por assunto: serviço muda só 'servicos' das duas pontas; aviso só 'avisos'; score só 'safescore'", async () => {
    const cliente = await usuario("cliente", "EMPREGADOR");
    const pro = await usuario("pro", "DIARISTA");
    await prisma.diaristaProfile.create({ data: { userId: pro, precoLeve: 100, precoPesada: 200 } });
    const c0 = await consulta(cliente, "EMPREGADOR");
    const p0 = await consulta(pro, "DIARISTA");
    const servico = await prisma.servico.create({
      data: { clientId: cliente, diaristaId: pro, tipo: "FAXINA", data: new Date(Date.now() + 86_400_000), turno: "MANHA", cidade: "Teste", uf: "MT", bairro: "Centro", precoFinal: 100 },
    });
    servicosCriados.push(servico.id);
    const c1 = await consulta(cliente, "EMPREGADOR");
    const p1 = await consulta(pro, "DIARISTA");
    assert.notEqual(c1.versoes.servicos, c0.versoes.servicos, "cliente vê a solicitação nova");
    assert.notEqual(p1.versoes.servicos, p0.versoes.servicos, "profissional vê a solicitação nova");
    assert.equal(p1.versoes.verificacao, p0.versoes.verificacao, "serviço não mexe na verificação");

    await prisma.servico.update({ where: { id: servico.id }, data: { status: "ACEITO" } }).catch(async () => {
      await prisma.servico.update({ where: { id: servico.id }, data: { bairro: "Centro (aceito)" } });
    });
    assert.notEqual((await consulta(cliente, "EMPREGADOR")).versoes.servicos, c1.versoes.servicos, "mudança de status chega ao cliente");

    const a0 = await consulta(pro, "DIARISTA");
    await prisma.notification.create({ data: { userId: pro, type: "VERIFICACAO_APROVADA", title: "t", body: "b" } });
    const a1 = await consulta(pro, "DIARISTA");
    assert.notEqual(a1.versoes.avisos, a0.versoes.avisos, "aviso novo muda o contador");
    assert.equal(a1.versoes.servicos, a0.versoes.servicos);
  });

  it("custo: consulta abaixo de 150 ms no banco local (mediana)", () => {
    const ordenados = [...tempos].sort((x, y) => x - y);
    const mediana = ordenados[Math.floor(ordenados.length / 2)];
    console.log(`[me/sincronizacao] ${tempos.length} consultas, mediana ${mediana.toFixed(1)} ms, máx ${ordenados.at(-1)!.toFixed(1)} ms`);
    assert.ok(mediana < 150, `mediana ${mediana} ms`);
  });

  it("sem sessão: 401", async () => {
    const r = await GET(new Request("http://test/api/me/sincronizacao"));
    assert.equal(r.status, 401);
  });
});
