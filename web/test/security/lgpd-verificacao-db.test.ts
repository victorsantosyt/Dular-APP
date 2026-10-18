import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

/**
 * Exclusão de conta (LGPD) depois das mudanças na verificação documental:
 * cada envio guarda uma fotografia com CPF, nascimento, endereço e nomes, e
 * cada decisão guarda motivo. A exclusão tem que levar tudo isso junto — as
 * fotografias, o histórico de decisões, os arquivos de frente e verso de TODOS
 * os envios — e não só `nomeCompleto`.
 *
 * Postgres real (SAFESCORE_DB_URL local). O S3 é interceptado: nenhuma chamada sai.
 */
const URL_BANCO = process.env.SAFESCORE_DB_URL;
const PULAR = !URL_BANCO
  ? "defina SAFESCORE_DB_URL (Postgres local com as migrations aplicadas)"
  : !/@(localhost|127\.0\.0\.1)[:/]/.test(URL_BANCO)
    ? "SAFESCORE_DB_URL não aponta para localhost — recusado"
    : false;
const EXIGIDO = process.env.SAFESCORE_DB_REQUIRED === "1";

const CPF = "11144477735";
const NOME_COMPLETO = "Joana Exclusão de Teste";
const RUA = "Rua da Exclusão de Teste";

describe("exclusão de conta: fotografias, histórico de decisões e documentos (DB)", { skip: EXIGIDO ? false : PULAR }, () => {
  let prisma: any;
  let anonimizar: (u: string) => Promise<any>;
  let fotografar: (db: any, u: string, agora: Date) => Promise<any>;
  let aprovar: (r: Request) => Promise<Response>;
  let reprovar: (r: Request) => Promise<Response>;
  let makeAuthHeaders: (u: string, r: any) => Record<string, string>;
  const RUN = `t_lgpdv_${Date.now().toString(36)}`;
  const ids: string[] = [];
  const removidas: string[] = [];
  let admin = "";
  let ip = 0;

  async function usuario(sufixo: string, role: string, extra: Record<string, unknown> = {}) {
    const id = `${RUN}_${sufixo}`;
    await prisma.user.create({ data: { id, nome: `Teste ${sufixo}`, role, status: "ATIVO", ...extra } });
    ids.push(id);
    return id;
  }
  const pedido = (verificationId: string, corpo: Record<string, unknown>) =>
    new Request("http://test/api/admin/verificacoes/x", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `10.7.0.${++ip}`, ...makeAuthHeaders(admin, "ADMIN") },
      body: JSON.stringify({ verificationId, conferencia: { documentoLegivel: true, dadosConferem: true, selfieCompativel: true }, motivoCategoria: "IMAGEM_ILEGIVEL", ...corpo }),
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
    const { getS3Client } = await import("../../src/lib/s3");
    // Intercepta o S3: registra a chave, nada sai para a AWS.
    (getS3Client() as any).send = async (cmd: { input: { Key: string } }) => { removidas.push(cmd.input.Key); return {}; };
    anonimizar = (await import("../../src/lib/lgpd")).anonimizarUsuario;
    fotografar = (await import("../../src/lib/dadosVerificacao")).fotografarDadosCadastrais;
    aprovar = (await import("../../src/app/api/admin/verificacoes/approve/route")).POST;
    reprovar = (await import("../../src/app/api/admin/verificacoes/reprove/route")).POST;
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
    await prisma.enderecoUsuario.deleteMany({ where: { userId: { in: ids } } });
    await prisma.diaristaProfile.deleteMany({ where: { userId: { in: ids } } });
    await prisma.montadorPerfil.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  it("dois envios com fotografia, decisões e revisão: nada do titular sobra; arquivos dos dois envios removidos", async () => {
    const u = await usuario("titular", "DIARISTA", { nomeCompleto: NOME_COMPLETO, cpf: CPF, dataNascimento: new Date("1988-02-03T00:00:00Z") });
    await prisma.enderecoUsuario.create({ data: { userId: u, tipo: "RESIDENCIAL", cep: "78000000", rua: RUA, numero: "1", bairro: "Centro", cidade: "Cuiabá", uf: "MT" } });
    const chaves = [`verificacoes/${RUN}/1f.jpg`, `verificacoes/${RUN}/1v.jpg`, `verificacoes/${RUN}/2f.jpg`, `verificacoes/${RUN}/2v.jpg`, `verificacoes/${RUN}/1s.jpg`, `verificacoes/${RUN}/2s.jpg`];
    await prisma.diaristaProfile.create({ data: { userId: u, precoLeve: 100, precoPesada: 200, docUrl: JSON.stringify({ frente: chaves[2], verso: chaves[3] }) } });
    const envio = async (f: string, v: string, selfie: string) => {
      const agora = new Date();
      return prisma.documentVerification.create({
        data: { userId: u, docType: "KYC_DOCS", createdAt: agora, docUrl: JSON.stringify({ frente: f, verso: v, selfie, uploadedAt: agora.toISOString() }), dadosEnviados: await fotografar(prisma, u, agora) },
      });
    };
    const v1 = await envio(chaves[0], chaves[1], chaves[4]);
    assert.equal((await reprovar(pedido(v1.id, { motivo: `CPF ${CPF} não confere com o documento` }))).status, 200);
    await new Promise((ok) => setTimeout(ok, 5));
    const v2 = await envio(chaves[2], chaves[3], chaves[5]);
    assert.equal((await aprovar(pedido(v2.id, { motivo: "ok" }))).status, 200);
    assert.equal((await reprovar(pedido(v2.id, { motivo: `revisão: ${NOME_COMPLETO} diverge`, revisao: true, esperado: "APROVADO" }))).status, 200);
    assert.ok((await prisma.decisaoVerificacao.count({ where: { verificacaoId: { in: [v1.id, v2.id] } } })) >= 3, "controle positivo: há histórico");

    const resumo = await anonimizar(u);

    assert.equal(resumo.apagados.fotografiasDeEnvio, 2);
    assert.ok(resumo.apagados.decisoesDeVerificacao >= 3);
    assert.equal(await prisma.documentVerification.count({ where: { userId: u } }), 0, "envios (e fotografias) apagados");
    assert.equal(await prisma.decisaoVerificacao.count({ where: { verificacaoId: { in: [v1.id, v2.id] } } }), 0, "histórico de decisões apagado");
    assert.deepEqual([...removidas].sort(), [...chaves].sort(), "frente, verso e selfie de todos os envios");
    assert.equal(await prisma.notification.count({ where: { userId: u } }), 0);
    assert.equal(await prisma.enderecoUsuario.count({ where: { userId: u } }), 0);

    const user = await prisma.user.findUnique({ where: { id: u } });
    assert.equal(user.status, "REMOVIDO");
    for (const campo of ["cpf", "nomeCompleto", "dataNascimento", "email", "telefone"]) assert.equal(user[campo], null, campo);

    // Varredura do que é preservado (ledger do score): nenhum texto do titular.
    const restos = await prisma.$queryRaw`
      SELECT
        (SELECT count(*)::int FROM "ScoreEvento" e JOIN "SafeScore" s ON s.id = e."safeScoreId"
          WHERE s."userId" = ${u} AND (e.descricao LIKE ${"%" + CPF + "%"} OR e.descricao LIKE ${"%" + NOME_COMPLETO + "%"})) AS legado,
        (SELECT count(*)::int FROM "SafeScoreEvent" WHERE "userId" = ${u}
          AND (payload::text LIKE ${"%" + CPF + "%"} OR payload::text LIKE ${"%" + NOME_COMPLETO + "%"})) AS v2,
        (SELECT count(*)::int FROM "SafeScoreEvent" WHERE "userId" = ${u}) AS eventos_preservados`;
    assert.equal(restos[0].legado, 0);
    assert.equal(restos[0].v2, 0);
    assert.ok(restos[0].eventos_preservados > 0, "o ledger continua (desvinculado), só sem o texto");
  });

  it("montador com documentos no fluxo antigo: arquivos removidos e campos limpos", async () => {
    removidas.length = 0;
    const m = await usuario("montador", "MONTADOR");
    await prisma.montadorPerfil.create({
      data: {
        userId: m, especialidades: [], bairros: [], portfolioFotos: [], fotoPerfil: "data:image/png;base64,AAAA",
        documentoFrente: `montadores/${RUN}/frente.jpg`, documentoVerso: `montadores/${RUN}/verso.jpg`, selfieDoc: "https://externo.exemplo/selfie.jpg",
      },
    });
    await anonimizar(m);
    assert.deepEqual([...removidas].sort(), [`montadores/${RUN}/frente.jpg`, `montadores/${RUN}/verso.jpg`], "só chaves do bucket");
    const p = await prisma.montadorPerfil.findUnique({ where: { userId: m } });
    assert.deepEqual([p.documentoFrente, p.documentoVerso, p.selfieDoc, p.fotoPerfil, p.ativo], [null, null, null, null, false]);
  });
});

// Encerra o pool do Prisma ao fim do arquivo. Sem isto, as conexões ociosas
// seguram o processo por ~10 s (pg-pool: idleTimeoutMillis = 10 s,
// allowExitOnIdle = false) — e sem prazo se uma conexão ficar presa numa
// transação de um teste que falhou.
after(async () => {
  await (globalThis as { prisma?: { $disconnect(): Promise<void> } }).prisma?.$disconnect();
});
