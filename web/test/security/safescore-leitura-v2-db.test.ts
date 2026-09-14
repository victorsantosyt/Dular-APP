import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { makeAuthHeaders } from "./_helpers";

/**
 * PR B, etapa 3 contra Postgres REAL: leituras só do V2, corte único e o par
 * resolver/ResolutionPanel com exibição separada do gatilho de suspensão.
 *
 * O legado é usado como ARMADILHA: recebe um score que mudaria a decisão se
 * alguma leitura ainda o consultasse.
 *
 * Mesmo protocolo das outras suítes de banco: SAFESCORE_DB_URL local;
 * obrigatório no CI (SAFESCORE_DB_REQUIRED=1).
 */

const URL_BANCO = process.env.SAFESCORE_DB_URL;
const PULAR = !URL_BANCO
  ? "defina SAFESCORE_DB_URL (Postgres local com as migrations aplicadas)"
  : !/@(localhost|127\.0\.0\.1)[:/]/.test(URL_BANCO)
    ? "SAFESCORE_DB_URL não aponta para localhost — recusado"
    : false;
const EXIGIDO = process.env.SAFESCORE_DB_REQUIRED === "1";

type Handler = (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
type Role = "EMPREGADOR" | "DIARISTA" | "MONTADOR" | "ADMIN";

describe("leituras V2 e resolver contra Postgres real", { skip: EXIGIDO ? false : PULAR }, () => {
  let prisma: any;
  let getGuardianStatusForUser: (userId: string) => Promise<{ score: number; motivos: string[] }>;
  let scoreToTier: (score: number) => string;
  let scoreUsuario: Handler;
  let montadorMe: (req: Request) => Promise<Response>;
  let montadorPorId: Handler;
  let buscaMontadores: (req: Request) => Promise<Response>;
  let buscaDiaristas: (req: Request) => Promise<Response>;
  let resolver: Handler;

  const RUN = `t_ssl3_${Date.now().toString(36)}`;
  // Cidade exclusiva da execução: as buscas só enxergam os perfis deste teste.
  const CIDADE = `Cidade ${RUN}`;
  const usuarios: string[] = [];

  async function usuario(sufixo: string, role: Role, status = "ATIVO") {
    const id = `${RUN}_${sufixo}`;
    await prisma.user.create({ data: { id, nome: `Teste etapa 3 ${sufixo}`, role, status } });
    usuarios.push(id);
    return id;
  }

  const legado = (userId: string, score: number) =>
    prisma.safeScore.upsert({ where: { userId }, create: { userId, score }, update: { score } });

  const perfilV2 = (userId: string, currentScore: number) =>
    prisma.safeScoreProfile.upsert({
      where: { userId },
      create: { userId, currentScore, tier: scoreToTier(currentScore) },
      update: { currentScore, tier: scoreToTier(currentScore) },
    });

  async function montadorPublicado(sufixo: string) {
    const id = await usuario(sufixo, "MONTADOR");
    await prisma.montadorPerfil.create({
      data: {
        userId: id,
        bio: "Monto móveis planejados",
        especialidades: ["montagem"],
        bairros: [],
        portfolioFotos: [],
        cidade: CIDADE,
        estado: "MT",
        atendeTodaCidade: true,
        verificado: true,
        ativo: true,
      },
    });
    return id;
  }

  async function diaristaPublicada(sufixo: string) {
    const id = await usuario(sufixo, "DIARISTA");
    await prisma.diaristaProfile.create({
      data: {
        userId: id,
        bio: "Faço faxina completa",
        verificacao: "VERIFICADO",
        ativo: true,
        precoLeve: 10000,
        precoPesada: 15000,
        servicosOferecidos: ["DIARISTA"],
        cidade: CIDADE,
        estado: "MT",
        atendeTodaCidade: true,
      },
    });
    return id;
  }

  const busca = `cidade=${encodeURIComponent(CIDADE)}&uf=MT`;
  const json = async (res: Response) => ({ status: res.status, body: await res.json() });

  async function aparecemNasBuscas(montador: string, diarista: string) {
    const m = await json(await buscaMontadores(new Request(`http://test/api/montadores/buscar?${busca}`)));
    const d = await json(await buscaDiaristas(new Request(`http://test/api/diaristas/buscar?${busca}`)));
    assert.equal(m.status, 200, JSON.stringify(m.body));
    assert.equal(d.status, 200, JSON.stringify(d.body));
    return {
      montador: m.body.montadores.some((x: any) => x.userId === montador),
      diarista: d.body.diaristas.some((x: any) => x.userId === diarista),
    };
  }

  async function resolverComo(incidenteId: string, admin: string, resolucao: "CONFIRMADA" | "ARQUIVADA") {
    const res = await resolver(
      new Request(`http://test/${incidenteId}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...makeAuthHeaders(admin, "ADMIN") },
        body: JSON.stringify({ resolucao }),
      }),
      { params: Promise.resolve({ id: incidenteId }) },
    );
    return json(res);
  }

  async function incidente(reportedUserId: string, reportedById: string, gravidade: string) {
    const inc = await prisma.incidentReport.create({
      data: { reportedById, reportedUserId, type: "OUTRO", gravidade, description: `teste ${RUN}` },
    });
    return inc.id as string;
  }

  async function ledgers(userId: string) {
    const [l, v, u] = await Promise.all([
      prisma.safeScore.findUnique({ where: { userId } }),
      prisma.safeScoreProfile.findUnique({ where: { userId } }),
      prisma.user.findUnique({ where: { id: userId }, select: { status: true } }),
    ]);
    return { legado: l?.score ?? null, v2: v?.currentScore ?? null, status: u.status };
  }

  before(async () => {
    if (PULAR) throw new Error(`SAFESCORE_DB_REQUIRED=1, mas ${PULAR}`);
    process.env.DATABASE_URL = URL_BANCO;
    ({ prisma } = await import("../../src/lib/prisma"));
    ({ getGuardianStatusForUser } = await import("../../src/lib/safeScoreGuardian"));
    ({ scoreToTier } = await import("../../src/lib/safeScore/applyEvent"));
    scoreUsuario = (await import("../../src/app/api/usuarios/[id]/score/route")).GET as Handler;
    montadorMe = (await import("../../src/app/api/montador/me/route")).GET;
    montadorPorId = (await import("../../src/app/api/montadores/[id]/route")).GET as Handler;
    buscaMontadores = (await import("../../src/app/api/montadores/buscar/route")).GET;
    buscaDiaristas = (await import("../../src/app/api/diaristas/buscar/route")).GET;
    resolver = (await import("../../src/app/api/admin/incidentes/[id]/resolver/route")).POST as Handler;
  });

  after(async () => {
    if (!prisma) return;
    await prisma.safeScoreEvent.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.safeScoreProfile.deleteMany({ where: { userId: { in: usuarios } } });
    const legados = await prisma.safeScore.findMany({ where: { userId: { in: usuarios } }, select: { id: true } });
    await prisma.scoreEvento.deleteMany({ where: { safeScoreId: { in: legados.map((l: any) => l.id) } } });
    await prisma.safeScore.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.incidentReport.deleteMany({ where: { reportedUserId: { in: usuarios } } });
    await prisma.montadorPerfil.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.diaristaProfile.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.user.deleteMany({ where: { id: { in: usuarios } } });
    await prisma.$disconnect();
  });

  it("legado 100 sem perfil V2: as seis leituras leem 500 e nenhuma bloqueia", async () => {
    const mont = await montadorPublicado("arm_mont");
    const dia = await diaristaPublicada("arm_dia");
    await legado(mont, 100);
    await legado(dia, 100);

    // 1. Guardian
    for (const u of [mont, dia]) {
      const g = await getGuardianStatusForUser(u);
      assert.equal(g.score, 500, u);
      assert.equal(g.motivos.includes("score_baixo"), false, u);
    }

    // 2. usuarios/[id]/score
    const s = await json(
      await scoreUsuario(
        new Request(`http://test/api/usuarios/${mont}/score`, { headers: makeAuthHeaders(mont, "MONTADOR") }),
        { params: Promise.resolve({ id: mont }) },
      ),
    );
    assert.equal(s.status, 200, JSON.stringify(s.body));
    assert.deepEqual({ faixa: s.body.faixa, bloqueado: s.body.bloqueado }, { faixa: "Em Observação", bloqueado: false });

    // 3. montador/me
    const me = await json(await montadorMe(new Request("http://test/api/montador/me", { headers: makeAuthHeaders(mont, "MONTADOR") })));
    assert.equal(me.status, 200, JSON.stringify(me.body));
    assert.deepEqual(
      { faixa: me.body.perfil.safeScore.faixa, bloqueado: me.body.perfil.safeScore.bloqueado },
      { faixa: "Em Observação", bloqueado: false },
    );

    // 4. montadores/[id]
    const porId = await json(
      await montadorPorId(new Request(`http://test/api/montadores/${mont}`), { params: Promise.resolve({ id: mont }) }),
    );
    assert.equal(porId.status, 200, JSON.stringify(porId.body));
    assert.equal(porId.body.montador.safeScore.bloqueado, false);

    // 5 e 6. buscas
    assert.deepEqual(await aparecemNasBuscas(mont, dia), { montador: true, diarista: true });
  });

  it("corte único nas bordas, com o legado dizendo o contrário: 399.5 bloqueia e 400 libera nos três pontos", async () => {
    const mont = await montadorPublicado("borda_mont");
    const dia = await diaristaPublicada("borda_dia");

    for (const u of [mont, dia]) {
      await perfilV2(u, 399.5);
      await legado(u, 900);
    }
    assert.equal((await getGuardianStatusForUser(mont)).motivos.includes("score_baixo"), true);
    assert.equal((await getGuardianStatusForUser(dia)).motivos.includes("score_baixo"), true);
    assert.deepEqual(await aparecemNasBuscas(mont, dia), { montador: false, diarista: false });

    for (const u of [mont, dia]) {
      await perfilV2(u, 400);
      await legado(u, 100);
    }
    assert.equal((await getGuardianStatusForUser(mont)).motivos.includes("score_baixo"), false);
    assert.equal((await getGuardianStatusForUser(dia)).motivos.includes("score_baixo"), false);
    assert.deepEqual(await aparecemNasBuscas(mont, dia), { montador: true, diarista: true });
  });

  describe("resolver: exibição (V2) separada do gatilho de suspensão (legado)", () => {
    let admin: string;
    let denunciante: string;

    before(async () => {
      admin = await usuario("res_admin", "ADMIN");
      denunciante = await usuario("res_emp", "EMPREGADOR");
    });

    it("exibição: com os ledgers divergentes, a tela recebe o score do V2", async () => {
      const u = await usuario("res_exib", "DIARISTA");
      await perfilV2(u, 700);
      await legado(u, 650);

      const r = await resolverComo(await incidente(u, denunciante, "MEDIA"), admin, "ARQUIVADA");

      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.safeScore.score, 710);
      assert.equal(r.body.faixa.label, "Confiável");
      assert.deepEqual(r.body.usuario, { status: "ATIVO", suspensoAutomaticamente: false });
      assert.deepEqual(await ledgers(u), { legado: 660, v2: 710, status: "ATIVO" });
    });

    it("gatilho: legado abaixo de 200 suspende, e a tela recebe a suspensão como fato", async () => {
      const u = await usuario("res_susp", "DIARISTA");
      await perfilV2(u, 300);
      await legado(u, 300);

      const r = await resolverComo(await incidente(u, denunciante, "CRITICA"), admin, "CONFIRMADA");

      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.safeScore.score, 0);
      assert.deepEqual(r.body.usuario, { status: "BLOQUEADO", suspensoAutomaticamente: true });
      assert.deepEqual(await ledgers(u), { legado: 0, v2: 0, status: "BLOQUEADO" });
    });

    it("gatilho segue o LEGADO: V2 abaixo de 200 com legado em 200 não suspende (decisão pendente)", async () => {
      const u = await usuario("res_v2baixo", "DIARISTA");
      await perfilV2(u, 250);
      await legado(u, 350);

      const r = await resolverComo(await incidente(u, denunciante, "ALTA"), admin, "CONFIRMADA");

      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.safeScore.score, 100);
      // "Suspenso" aqui é só o rótulo da faixa de exibição; a conta segue ativa.
      assert.equal(r.body.faixa.label, "Suspenso");
      assert.deepEqual(r.body.usuario, { status: "ATIVO", suspensoAutomaticamente: false });
      assert.deepEqual(await ledgers(u), { legado: 200, v2: 100, status: "ATIVO" });
    });

    it("gatilho segue o LEGADO: legado abaixo de 200 com V2 em 300 suspende, e o aviso aparece", async () => {
      // O painel antigo deduzia o aviso de `score < 200`; com o score exibido
      // vindo do V2 (300), ele esconderia uma suspensão que aconteceu.
      const u = await usuario("res_legbaixo", "DIARISTA");
      await perfilV2(u, 450);
      await legado(u, 250);

      const r = await resolverComo(await incidente(u, denunciante, "ALTA"), admin, "CONFIRMADA");

      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.safeScore.score, 300);
      assert.deepEqual(r.body.usuario, { status: "BLOQUEADO", suspensoAutomaticamente: true });
      assert.deepEqual(await ledgers(u), { legado: 100, v2: 300, status: "BLOQUEADO" });
    });

    it("conta que já estava bloqueada: não anuncia suspensão automática", async () => {
      const u = await usuario("res_jabloq", "DIARISTA", "BLOQUEADO");
      await perfilV2(u, 150);
      await legado(u, 150);

      const r = await resolverComo(await incidente(u, denunciante, "MEDIA"), admin, "ARQUIVADA");

      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.deepEqual(r.body.usuario, { status: "BLOQUEADO", suspensoAutomaticamente: false });
    });
  });
});
