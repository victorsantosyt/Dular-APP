import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

/**
 * Conferência documental no painel, nos três perfis: dados enviados em cada
 * submissão x cadastro atual, campos ausentes como ausentes, decisão com
 * responsável e data, motivo que a pessoa vê no app, e nada de segredo no
 * detalhe nem de CPF no log.
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

// CPFs válidos de teste (dígitos verificadores corretos), nunca de pessoa real conhecida.
const CPFS = ["52998224725", "11144477735", "39053344705"];

describe("conferência documental: dados enviados, cadastro atual e decisão (DB)", { skip: EXIGIDO ? false : PULAR }, () => {
  let prisma: any;
  let detalhe: (id: string) => Promise<any>;
  let fotografar: (db: any, userId: string, agora: Date) => Promise<any>;
  let aprovar: (r: Request) => Promise<Response>;
  let reprovar: (r: Request) => Promise<Response>;
  let getMe: (r: Request) => Promise<Response>;
  let makeAuthHeaders: (u: string, r: any) => Record<string, string>;
  const RUN = `t_conf_${Date.now().toString(36)}`;
  const ids: string[] = [];
  let admin = "";
  let ip = 0;

  async function usuario(sufixo: string, role: string, extra: Record<string, unknown> = {}) {
    const id = `${RUN}_${sufixo}`;
    await prisma.user.create({ data: { id, nome: `Teste ${sufixo}`, role, status: "ATIVO", ...extra } });
    ids.push(id);
    return id;
  }

  /** Envio como a rota de upload grava: frente, verso e a fotografia do mesmo instante. */
  async function enviar(userId: string, docType: string) {
    const agora = new Date();
    const dadosEnviados = await fotografar(prisma, userId, agora);
    return prisma.documentVerification.create({
      data: {
        userId, docType, createdAt: agora,
        docUrl: JSON.stringify({ frente: `verificacoes/${RUN}/f.jpg`, verso: `verificacoes/${RUN}/v.jpg`, selfie: `verificacoes/${RUN}/s.jpg`, uploadedAt: agora.toISOString() }),
        reviewNote: `Submetido em ${agora.toISOString()}`,
        dadosEnviados,
      },
    });
  }

  const pedido = (verificationId: string, corpo: Record<string, unknown>) =>
    new Request("http://test/api/admin/verificacoes/x", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `10.8.0.${++ip}`, ...makeAuthHeaders(admin, "ADMIN") },
      body: JSON.stringify({ verificationId, conferencia: { documentoLegivel: true, dadosConferem: true, selfieCompativel: true }, motivoCategoria: "IMAGEM_ILEGIVEL", ...corpo }),
    });

  async function comLog<T>(fn: () => Promise<T>): Promise<{ r: T; log: string }> {
    const linhas: string[] = [];
    const orig = { log: console.log, warn: console.warn, error: console.error, info: console.info };
    for (const k of Object.keys(orig) as (keyof typeof orig)[]) console[k] = (...a: unknown[]) => { linhas.push(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ")); };
    try {
      return { r: await fn(), log: linhas.join("\n") };
    } finally {
      Object.assign(console, orig);
    }
  }

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
    process.env.DULAR_VERIFICACAO_SELFIE = "ligado";
    ({ prisma } = await import("../../src/lib/prisma"));
    detalhe = (await import("../../src/lib/adminVerificacoes")).getAdminVerificacaoDetail;
    fotografar = (await import("../../src/lib/dadosVerificacao")).fotografarDadosCadastrais;
    aprovar = (await import("../../src/app/api/admin/verificacoes/approve/route")).POST;
    reprovar = (await import("../../src/app/api/admin/verificacoes/reprove/route")).POST;
    getMe = (await import("../../src/app/api/me/route")).GET;
    ({ makeAuthHeaders } = await import("./_helpers"));
    admin = await usuario("admin", "ADMIN", { nome: "Admin Conferência" });
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
    await prisma.empregadorPerfil.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  const perfis = [
    { role: "EMPREGADOR", docType: "EMPREGADOR_KYC", cpf: CPFS[0] },
    { role: "DIARISTA", docType: "KYC_DOCS", cpf: CPFS[1] },
    { role: "MONTADOR", docType: "MONTADOR_KYC", cpf: CPFS[2] },
  ] as const;

  for (const p of perfis) {
    it(`${p.role}: dados enviados x cadastro atual, alteração destacada, decisão com responsável e motivo no app`, async () => {
      const u = await usuario(p.role.toLowerCase(), p.role, {
        nomeCompleto: `Maria ${p.role} da Silva`,
        cpf: `${p.cpf}`,
        dataNascimento: new Date("1990-05-17T00:00:00Z"),
        email: `${RUN}_${p.role.toLowerCase()}@exemplo.test`,
      });
      if (p.role === "DIARISTA") await prisma.diaristaProfile.create({ data: { userId: u, precoLeve: 100, precoPesada: 200, cidade: "Cuiabá", estado: "MT", bairroAtual: "Centro" } });
      if (p.role === "MONTADOR") await prisma.montadorPerfil.create({ data: { userId: u, especialidades: [], bairros: [], portfolioFotos: [], cidade: "Cuiabá", estado: "MT" } });
      if (p.role === "EMPREGADOR") {
        await prisma.empregadorPerfil.create({ data: { userId: u } });
        await prisma.enderecoUsuario.create({ data: { userId: u, tipo: "RESIDENCIAL", cep: "78000000", rua: "Rua Teste", numero: "10", bairro: "Centro", cidade: "Cuiabá", uf: "MT" } });
      }
      const v = await enviar(u, p.docType);

      // Alteração cadastral DEPOIS do envio.
      await prisma.user.update({ where: { id: u }, data: { nomeCompleto: `Maria ${p.role} Souza` } });

      const { r: d, log } = await comLog(() => detalhe(v.id));
      assert.equal(d.dadosEnviados.nomeCompleto, `Maria ${p.role} da Silva`, "o que foi enviado");
      assert.equal(d.cadastroAtual.nomeCompleto, `Maria ${p.role} Souza`, "o que está agora");
      assert.deepEqual(d.camposAlterados, ["nomeCompleto"], "só o campo que mudou");
      assert.equal(d.dadosEnviados.cpf, p.cpf);
      assert.equal(d.dadosEnviados.dataNascimento, "1990-05-17");
      assert.equal(d.dadosEnviados.telefone, null, "ausente fica ausente");
      assert.equal(d.dadosEnviados.perfil, p.role);
      assert.equal(d.dadosEnviados.nomeExibicao, `Teste ${p.role.toLowerCase()}`, "nome de exibição separado do completo");
      assert.equal(d.documents.datasDivergentes, false, "imagens e registro do mesmo envio");
      assert.equal(d.history.find((h: any) => h.atual)?.id, v.id);
      assert.equal(d.verification.maisRecente, true);
      const texto = JSON.stringify(d);
      assert.doesNotMatch(texto, /senhaHash|pushToken|tokenLoja|reviewNote/, "sem segredo nem nota interna");
      assert.doesNotMatch(log, new RegExp(p.cpf), "CPF fora do log");
      assert.doesNotMatch(log, /X-Amz-/, "URL assinada fora do log");

      // Reprovar (motivo vai para o app), depois a decisão aparece com responsável e data.
      const motivo = "Foto do verso ilegível. Envie novamente.";
      const { r: resp, log: logDecisao } = await comLog(() => reprovar(pedido(v.id, { motivo, tipo: "REENVIO" })));
      assert.equal(resp.status, 200);
      assert.doesNotMatch(logDecisao, new RegExp(p.cpf));
      const d2 = await detalhe(v.id);
      assert.equal(d2.verification.decisao, "REENVIO");
      assert.equal(d2.verification.decididoPor, "Admin Conferência");
      assert.ok(d2.verification.decididoEm);
      const motivoNoApp = `Imagem ilegível: ${motivo}`;
      assert.equal(d2.verification.motivoUsuario, motivoNoApp, "categoria + detalhe");

      const me = await (await getMe(new Request("http://test/api/me", { headers: makeAuthHeaders(u, p.role) }))).json();
      assert.equal(me.user.motivoVerificacao, motivoNoApp, "o app recebe o motivo");
      assert.equal(me.user.decisaoVerificacao, "REENVIO");
      assert.equal(me.user.nomeCompleto, `Maria ${p.role} Souza`);
      const aviso = await prisma.notification.findFirst({ where: { userId: u, type: "VERIFICACAO_REPROVADA" } });
      assert.match(aviso.body, /Imagem ilegível/, "o aviso traz a categoria");
      assert.doesNotMatch(aviso.body, /verso ilegível/, "e não o texto livre (pode ter dado pessoal)");
    });
  }

  it("envio anterior à fotografia: o painel não reconstrói os dados enviados; campos ausentes ficam ausentes", async () => {
    const u = await usuario("legado", "EMPREGADOR");
    const v = await prisma.documentVerification.create({ data: { userId: u, docType: "EMPREGADOR_KYC", docUrl: "{}" } });
    const d = await detalhe(v.id);
    assert.equal(d.dadosEnviados, null);
    assert.deepEqual(d.camposAlterados, []);
    assert.equal(d.cadastroAtual.cpf, null);
    assert.equal(d.cadastroAtual.nomeCompleto, null);
    assert.equal(d.cadastroAtual.endereco, null);
    assert.equal(d.verification.decisao, null);
  });

  it("registro criado muito depois do upload (cópia de dados): datas divergentes sinalizadas", async () => {
    const u = await usuario("copiado", "MONTADOR");
    const v = await prisma.documentVerification.create({
      data: { userId: u, docType: "MONTADOR_KYC", status: "APPROVED", docUrl: JSON.stringify({ frente: "a", verso: "b", uploadedAt: "2026-07-01T12:00:00.000Z" }) },
    });
    const d = await detalhe(v.id);
    assert.equal(d.documents.datasDivergentes, true);
    assert.equal(d.verification.decisao, "APROVADO", "decisão antiga lida do status");
    assert.equal(d.verification.decididoEm, null, "sem data inventada");
  });

  it("nome completo: validado no servidor", async () => {
    // A rota também aceita a sessão da web (Auth.js), que exige um provider no import.
    Object.assign(process.env, { GOOGLE_CLIENT_ID: "teste", GOOGLE_CLIENT_SECRET: "teste", AUTH_SECRET: process.env.AUTH_SECRET || "teste-local" });
    const { PATCH } = await import("../../src/app/api/me/profile/route");
    const u = await usuario("nome", "EMPREGADOR");
    const enviar = (nomeCompleto: string) =>
      PATCH(new Request("http://test/api/me/profile", { method: "PATCH", headers: { "content-type": "application/json", ...makeAuthHeaders(u, "EMPREGADOR") }, body: JSON.stringify({ nomeCompleto }) }));
    assert.equal((await enviar("Maria")).status, 400, "só um nome");
    assert.equal((await enviar("Maria 123")).status, 400, "com números");
    assert.equal((await enviar("  Maria   da  Silva ")).status, 200);
    assert.equal((await prisma.user.findUnique({ where: { id: u } })).nomeCompleto, "Maria da Silva");
  });
});

// Encerra o pool do Prisma ao fim do arquivo. Sem isto, as conexões ociosas
// seguram o processo por ~10 s (pg-pool: idleTimeoutMillis = 10 s,
// allowExitOnIdle = false) — e sem prazo se uma conexão ficar presa numa
// transação de um teste que falhou.
after(async () => {
  await (globalThis as { prisma?: { $disconnect(): Promise<void> } }).prisma?.$disconnect();
});
