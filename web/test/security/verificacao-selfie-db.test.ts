import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

/**
 * Selfie para conferência MANUAL de identidade, nos três perfis:
 * - aprovar exige as três marcações do admin e um envio com selfie;
 * - envio antigo (sem selfie) não é aprovado — nem por revisão — mas conta já
 *   aprovada não é revogada;
 * - reprovar/pedir reenvio exige categoria do motivo;
 * - a selfie só sai, por link temporário, para ADMIN ativo no banco; nunca no log.
 *
 * Postgres real (SAFESCORE_DB_URL local), S3 fictício (assinar é cálculo local).
 */
const URL_BANCO = process.env.SAFESCORE_DB_URL;
const PULAR = !URL_BANCO
  ? "defina SAFESCORE_DB_URL (Postgres local com as migrations aplicadas)"
  : !/@(localhost|127\.0\.0\.1)[:/]/.test(URL_BANCO)
    ? "SAFESCORE_DB_URL não aponta para localhost — recusado"
    : false;
const EXIGIDO = process.env.SAFESCORE_DB_REQUIRED === "1";
const CONFERIDO = { documentoLegivel: true, dadosConferem: true, selfieCompativel: true };

describe("selfie na verificação: aprovação, compatibilidade e acesso (DB)", { skip: EXIGIDO ? false : PULAR }, () => {
  let prisma: any;
  let aprovar: (r: Request) => Promise<Response>;
  let reprovar: (r: Request) => Promise<Response>;
  let detalheRota: (r: Request, c: { params: Promise<{ id: string }> }) => Promise<Response>;
  let guardian: (u: string) => Promise<any>;
  let makeAuthHeaders: (u: string, r: any) => Record<string, string>;
  const RUN = `t_selfie_${Date.now().toString(36)}`;
  const ids: string[] = [];
  let admin = "";
  let ip = 0;

  async function usuario(sufixo: string, role: string) {
    const id = `${RUN}_${sufixo}`;
    await prisma.user.create({ data: { id, nome: `Teste ${sufixo}`, role, status: "ATIVO" } });
    ids.push(id);
    return id;
  }
  async function conta(role: string, sufixo: string) {
    const u = await usuario(sufixo, role);
    if (role === "DIARISTA") await prisma.diaristaProfile.create({ data: { userId: u, precoLeve: 100, precoPesada: 200 } });
    if (role === "MONTADOR") await prisma.montadorPerfil.create({ data: { userId: u, especialidades: [], bairros: [], portfolioFotos: [] } });
    return u;
  }
  const envio = (u: string, role: string, comSelfie: boolean, status = "PENDING") =>
    prisma.documentVerification.create({
      data: {
        userId: u, docType: `${role}_KYC`, status,
        docUrl: JSON.stringify({ frente: `verificacoes/${RUN}/f.jpg`, verso: `verificacoes/${RUN}/v.jpg`, ...(comSelfie ? { selfie: `verificacoes/${RUN}/SELFIE-DE-TESTE.jpg` } : {}) }),
      },
    });
  const pedido = (verificationId: string, corpo: Record<string, unknown>, quem = admin, papel = "ADMIN") =>
    new Request("http://test/api/admin/verificacoes/x", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `10.5.0.${++ip}`, ...makeAuthHeaders(quem, papel) },
      body: JSON.stringify({ verificationId, motivo: "conferido", ...corpo }),
    });

  before(async () => {
    if (PULAR) throw new Error(`SAFESCORE_DB_REQUIRED=1, mas ${PULAR}`);
    Object.assign(process.env, {
      DATABASE_URL: URL_BANCO,
      S3_REGION: "sa-east-1",
      S3_BUCKET: "dular-staging-uploads-teste",
      S3_ACCESS_KEY_ID: "AKIAFICTICIOTESTE000",
      S3_SECRET_ACCESS_KEY: "segredo-ficticio-de-teste",
    });
    delete process.env.VERCEL_ENV;
    ({ prisma } = await import("../../src/lib/prisma"));
    aprovar = (await import("../../src/app/api/admin/verificacoes/approve/route")).POST;
    reprovar = (await import("../../src/app/api/admin/verificacoes/reprove/route")).POST;
    detalheRota = (await import("../../src/app/api/admin/verificacoes/[id]/route")).GET as any;
    guardian = (await import("../../src/lib/safeScoreGuardian")).getGuardianStatusForUser;
    ({ makeAuthHeaders } = await import("./_helpers"));
    admin = await usuario("admin", "ADMIN");
  });

  after(async () => {
    if (!prisma) return;
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.documentVerification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.safeScoreEvent.deleteMany({ where: { userId: { in: ids } } });
    await prisma.scoreEvento.deleteMany({ where: { safeScore: { userId: { in: ids } } } });
    await prisma.safeScore.deleteMany({ where: { userId: { in: ids } } });
    await prisma.safeScoreProfile.deleteMany({ where: { userId: { in: ids } } });
    await prisma.diaristaProfile.deleteMany({ where: { userId: { in: ids } } });
    await prisma.montadorPerfil.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  for (const role of ["EMPREGADOR", "DIARISTA", "MONTADOR"] as const) {
    it(`${role}: aprovar exige as três marcações; com elas e com selfie, aprova`, async () => {
      const u = await conta(role, `ok_${role.toLowerCase()}`);
      const v = (await envio(u, role, true)).id;
      for (const parcial of [undefined, { ...CONFERIDO, selfieCompativel: false }, { ...CONFERIDO, dadosConferem: false }, { ...CONFERIDO, documentoLegivel: false }]) {
        const r = await aprovar(pedido(v, { conferencia: parcial }));
        assert.equal(r.status, 400, JSON.stringify(parcial));
      }
      assert.equal((await prisma.documentVerification.findUnique({ where: { id: v } })).status, "PENDING");
      assert.equal((await aprovar(pedido(v, { conferencia: CONFERIDO }))).status, 200);
      assert.equal((await guardian(u)).verificationStatus, "VERIFICADO");
      const d = await prisma.decisaoVerificacao.findFirst({ where: { verificacaoId: v } });
      assert.deepEqual(d.conferencia, CONFERIDO, "marcações registradas no histórico");
    });
  }

  it("reprovar ou pedir reenvio exige categoria; o app recebe categoria + detalhe", async () => {
    const u = await conta("EMPREGADOR", "categoria");
    const v = (await envio(u, "EMPREGADOR", true)).id;
    assert.equal((await reprovar(pedido(v, { motivo: "rosto cortado" }))).status, 400, "sem categoria");
    assert.equal((await reprovar(pedido(v, { motivo: "rosto cortado", motivoCategoria: "INVENTADA" }))).status, 400);
    assert.equal((await reprovar(pedido(v, { motivo: "rosto cortado", motivoCategoria: "ROSTO_NAO_VISIVEL", tipo: "REENVIO" }))).status, 200);
    const linha = await prisma.documentVerification.findUnique({ where: { id: v } });
    assert.equal(linha.motivoUsuario, "Rosto não visível na selfie: rosto cortado");
    assert.equal(linha.decisao, "REENVIO");
  });

  it("envio antigo sem selfie: não aprova (nem por revisão); reenvio funciona; conta já aprovada continua aprovada", async () => {
    const u = await conta("DIARISTA", "antigo");
    const v = (await envio(u, "DIARISTA", false)).id;
    const r = await aprovar(pedido(v, { conferencia: CONFERIDO }));
    assert.equal(r.status, 409);
    assert.match((await r.json()).error, /não tem selfie/i);
    assert.equal((await reprovar(pedido(v, { motivoCategoria: "OUTRO", motivo: "Envie de novo com selfie.", tipo: "REENVIO" }))).status, 200);
    assert.equal((await aprovar(pedido(v, { conferencia: CONFERIDO, revisao: true, esperado: "REENVIO" }))).status, 409, "revisão não contorna");

    const aprovadaAntes = await conta("MONTADOR", "aprovada_antes");
    await prisma.montadorPerfil.update({ where: { userId: aprovadaAntes }, data: { verificado: true } });
    await envio(aprovadaAntes, "MONTADOR", false, "APPROVED");
    assert.equal((await guardian(aprovadaAntes)).verificationStatus, "VERIFICADO", "sem revogação automática");
  });

  it("selfie no painel: link temporário só para ADMIN ativo; envio antigo marcado; nada no log", async () => {
    const u = await conta("EMPREGADOR", "painel");
    const novo = (await envio(u, "EMPREGADOR", true)).id;
    const pedirDetalhe = async (id: string, quem: string, papel: string) => {
      const linhas: string[] = [];
      const orig = { log: console.log, warn: console.warn, error: console.error };
      for (const k of Object.keys(orig) as (keyof typeof orig)[]) console[k] = (...a: unknown[]) => { linhas.push(a.map(String).join(" ")); };
      try {
        const r = await detalheRota(new Request(`http://test/api/admin/verificacoes/${id}`, { headers: makeAuthHeaders(quem, papel) }), { params: Promise.resolve({ id }) });
        return { status: r.status, corpo: await r.text(), log: linhas.join("\n") };
      } finally {
        Object.assign(console, orig);
      }
    };
    const ok = await pedirDetalhe(novo, admin, "ADMIN");
    assert.equal(ok.status, 200);
    const d = JSON.parse(ok.corpo);
    assert.equal(d.documents.selfieColetada, true);
    assert.match(d.documents.selfie.signedUrl, /SELFIE-DE-TESTE.*X-Amz-Expires=300/, "link de 5 min");
    assert.doesNotMatch(ok.log, /X-Amz-|SELFIE-DE-TESTE/);

    const naoAdmin = await pedirDetalhe(novo, u, "EMPREGADOR");
    assert.equal(naoAdmin.status, 403);
    assert.doesNotMatch(naoAdmin.corpo, /SELFIE-DE-TESTE|X-Amz-/);
    const exAdmin = await pedirDetalhe(novo, u, "ADMIN");
    assert.equal(exAdmin.status, 403, "token dizendo ADMIN não basta");
    assert.doesNotMatch(exAdmin.corpo, /SELFIE-DE-TESTE|X-Amz-/);

    const antigo = (await envio(await conta("DIARISTA", "painel_antigo"), "DIARISTA", false)).id;
    const d2 = JSON.parse((await pedirDetalhe(antigo, admin, "ADMIN")).corpo);
    assert.equal(d2.documents.selfieColetada, false, "painel mostra 'Selfie não coletada nesta versão'");
    assert.equal(d2.documents.selfie, null);
  });
});
