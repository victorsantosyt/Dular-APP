import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { makeAuthHeaders } from "./_helpers";

/**
 * Escrita dupla do SafeScore (PR B, etapa 2) contra Postgres REAL, pelas rotas
 * de verdade: transação do confirmar, concorrência em confirmar e avaliar, V2
 * primeiro com legado condicional, e o motivo grave virando incidente revisável.
 *
 * Falhas são injetadas com gatilhos no banco restritos ao usuário do teste —
 * nada afeta outras suítes rodando ao mesmo tempo.
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

describe("escrita dupla SafeScore contra Postgres real", { skip: EXIGIDO ? false : PULAR }, () => {
  let prisma: any;
  let aplicarEvento: (u: string, t: any, r?: string, d?: string) => Promise<unknown>;
  let registrarMotivoGrave: (p: any) => Promise<void>;
  let confirmar: Handler;
  let avaliar: Handler;
  let resolver: Handler;

  const RUN = `t_sse2_${Date.now().toString(36)}`;
  const usuarios: string[] = [];
  const servicos: string[] = [];
  const gatilhos: Array<{ tabela: string; nome: string }> = [];

  async function usuario(sufixo: string, role: "EMPREGADOR" | "DIARISTA" | "ADMIN") {
    const id = `${RUN}_${sufixo}`;
    await prisma.user.create({ data: { id, nome: `Teste escrita dupla ${sufixo}`, role } });
    usuarios.push(id);
    return id;
  }

  async function servico(sufixo: string, clientId: string, diaristaId: string, status: string) {
    const id = `${RUN}_srv_${sufixo}`;
    await prisma.servico.create({
      data: {
        id,
        tipo: "FAXINA",
        data: new Date(),
        turno: "MANHA",
        cidade: "Agua Boa",
        uf: "MT",
        bairro: "Centro",
        precoFinal: 10000,
        clientId,
        diaristaId,
        status,
      },
    });
    servicos.push(id);
    return id;
  }

  /** Faz o INSERT em `tabela` falhar quando `condicao` vale. Devolve como desfazer. */
  async function falharInsert(tabela: "SafeScoreEvent" | "ScoreEvento", condicao: string) {
    const nome = `${RUN}_g${gatilhos.length}`;
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION "${nome}_fn"() RETURNS trigger AS $f$ BEGIN IF ${condicao} THEN RAISE EXCEPTION 'falha injetada pelo teste'; END IF; RETURN NEW; END $f$ LANGUAGE plpgsql`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER "${nome}_trg" BEFORE INSERT ON "${tabela}" FOR EACH ROW EXECUTE FUNCTION "${nome}_fn"()`,
    );
    const g = { tabela, nome };
    gatilhos.push(g);
    return async () => {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${nome}_trg" ON "${tabela}"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${nome}_fn"()`);
      gatilhos.splice(gatilhos.indexOf(g), 1);
    };
  }

  async function post(handler: Handler, id: string, userId: string, role: any, body: unknown = {}) {
    const res = await handler(
      new Request(`http://test/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...makeAuthHeaders(userId, role) },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id }) },
    );
    return { status: res.status, body: await res.json().catch(() => null) };
  }

  async function ledgers(userId: string) {
    const legado = await prisma.safeScore.findUnique({ where: { userId } });
    const v2 = await prisma.safeScoreProfile.findUnique({ where: { userId } });
    return {
      legado: legado?.score ?? null,
      v2: v2?.currentScore ?? null,
      eventosLegado: legado ? await prisma.scoreEvento.count({ where: { safeScoreId: legado.id } }) : 0,
      eventosV2: await prisma.safeScoreEvent.count({ where: { userId } }),
    };
  }

  const statusDo = async (id: string) => (await prisma.servico.findUnique({ where: { id } })).status;

  before(async () => {
    if (PULAR) throw new Error(`SAFESCORE_DB_REQUIRED=1, mas ${PULAR}`);
    process.env.DATABASE_URL = URL_BANCO;
    ({ prisma } = await import("../../src/lib/prisma"));
    ({ aplicarEvento } = await import("../../src/lib/safeScore"));
    ({ registrarMotivoGrave } = await import("../../src/lib/safetyMotivo"));
    confirmar = (await import("../../src/app/api/servicos/[id]/confirmar/route")).POST as Handler;
    avaliar = (await import("../../src/app/api/servicos/[id]/avaliar/route")).POST as Handler;
    resolver = (await import("../../src/app/api/admin/incidentes/[id]/resolver/route")).POST as Handler;

    const ativa = await prisma.safeScorePolicyVersion.findFirst({
      where: { deprecatedAt: null },
      orderBy: { publishedAt: "desc" },
    });
    assert.equal(ativa?.version, "1.1.0", "a política ativa precisa ser a 1.1.0 — rode as migrations");
  });

  after(async () => {
    if (!prisma) return;
    for (const g of [...gatilhos]) {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${g.nome}_trg" ON "${g.tabela}"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${g.nome}_fn"()`);
    }
    await prisma.safeScoreEvent.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.safeScoreProfile.deleteMany({ where: { userId: { in: usuarios } } });
    const legados = await prisma.safeScore.findMany({ where: { userId: { in: usuarios } }, select: { id: true } });
    await prisma.scoreEvento.deleteMany({ where: { safeScoreId: { in: legados.map((l: any) => l.id) } } });
    await prisma.safeScore.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.incidentReport.deleteMany({
      where: { OR: [{ reportedUserId: { in: usuarios } }, { reportedById: { in: usuarios } }] },
    });
    await prisma.servico.deleteMany({ where: { id: { in: servicos } } });
    await prisma.user.deleteMany({ where: { id: { in: usuarios } } });
    await prisma.$disconnect();
  });

  it("confirmar: status e os eventos dos dois lados sobem juntos", async () => {
    const emp = await usuario("c1_emp", "EMPREGADOR");
    const dia = await usuario("c1_dia", "DIARISTA");
    const srv = await servico("c1", emp, dia, "CONCLUIDO");

    const r = await post(confirmar, srv, emp, "EMPREGADOR");

    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(await statusDo(srv), "CONFIRMADO");
    for (const u of [emp, dia]) {
      assert.deepEqual(await ledgers(u), { legado: 505, v2: 505, eventosLegado: 1, eventosV2: 1 });
    }
  });

  it("confirmar: falha no score do profissional reverte o status E o evento já gravado do cliente", async () => {
    const emp = await usuario("c2_emp", "EMPREGADOR");
    const dia = await usuario("c2_dia", "DIARISTA");
    const srv = await servico("c2", emp, dia, "CONCLUIDO");
    const desfazer = await falharInsert("SafeScoreEvent", `NEW."userId" = '${dia}'`);

    const r = await post(confirmar, srv, emp, "EMPREGADOR");

    assert.equal(r.status, 500);
    assert.equal(await statusDo(srv), "CONCLUIDO", "o status tem que voltar com a falha");
    const vazio = { legado: null, v2: null, eventosLegado: 0, eventosV2: 0 };
    assert.deepEqual(await ledgers(emp), vazio, "o evento do cliente, gravado antes na mesma transação, tem que ser desfeito");
    assert.deepEqual(await ledgers(dia), vazio);

    // Com a causa resolvida, a confirmação pode ser repetida — antes ficava presa.
    await desfazer();
    const r2 = await post(confirmar, srv, emp, "EMPREGADOR");
    assert.equal(r2.status, 200, JSON.stringify(r2.body));
    assert.equal(await statusDo(srv), "CONFIRMADO");
    for (const u of [emp, dia]) {
      assert.deepEqual(await ledgers(u), { legado: 505, v2: 505, eventosLegado: 1, eventosV2: 1 });
    }
  });

  it("confirmar concorrente: 5 requisições simultâneas → uma passa, score contado uma vez", async () => {
    const emp = await usuario("c3_emp", "EMPREGADOR");
    const dia = await usuario("c3_dia", "DIARISTA");
    const srv = await servico("c3", emp, dia, "CONCLUIDO");

    const respostas = await Promise.all(Array.from({ length: 5 }, () => post(confirmar, srv, emp, "EMPREGADOR")));

    assert.deepEqual(respostas.map((r) => r.status).sort(), [200, 409, 409, 409, 409]);
    for (const u of [emp, dia]) {
      assert.deepEqual(await ledgers(u), { legado: 505, v2: 505, eventosLegado: 1, eventosV2: 1 });
    }
  });

  it("avaliar concorrente: 5 requisições simultâneas → uma avaliação, score contado uma vez", async () => {
    const emp = await usuario("a1_emp", "EMPREGADOR");
    const dia = await usuario("a1_dia", "DIARISTA");
    const srv = await servico("a1", emp, dia, "CONFIRMADO");
    const nota = { notaGeral: 5, pontualidade: 5, qualidade: 5, comunicacao: 5 };

    const respostas = await Promise.all(Array.from({ length: 5 }, () => post(avaliar, srv, emp, "EMPREGADOR", nota)));

    assert.equal(respostas.filter((r) => r.status === 200).length, 1, JSON.stringify(respostas.map((r) => r.status)));
    assert.equal(await prisma.avaliacao.count({ where: { servicoId: srv } }), 1);
    assert.equal(await statusDo(srv), "FINALIZADO");
    assert.deepEqual(await ledgers(dia), { legado: 515, v2: 515, eventosLegado: 1, eventosV2: 1 });
  });

  it("V2 primeiro: legado falhou → V2 fica, e a retentativa completa só o legado", async () => {
    const u = await usuario("heal", "DIARISTA");
    const desfazer = await falharInsert(
      "ScoreEvento",
      `NEW."safeScoreId" IN (SELECT id FROM "SafeScore" WHERE "userId" = '${u}')`,
    );

    await assert.rejects(aplicarEvento(u, "KYC_APROVADO", "doc-heal", "Documentos aprovados."), /falha injetada/);
    assert.deepEqual(await ledgers(u), { legado: null, v2: 550, eventosLegado: 0, eventosV2: 1 });

    await desfazer();
    await aplicarEvento(u, "KYC_APROVADO", "doc-heal", "Documentos aprovados.");
    assert.deepEqual(await ledgers(u), { legado: 550, v2: 550, eventosLegado: 1, eventosV2: 1 });
  });

  it("V2 falhou → nada no legado", async () => {
    const u = await usuario("v2falha", "DIARISTA");
    const desfazer = await falharInsert("SafeScoreEvent", `NEW."userId" = '${u}'`);
    await assert.rejects(aplicarEvento(u, "KYC_APROVADO", "doc-v2", "Documentos aprovados."), /falha injetada/);
    await desfazer();
    assert.deepEqual(await ledgers(u), { legado: null, v2: null, eventosLegado: 0, eventosV2: 0 });
  });

  it("registrarMotivoGrave: um incidente por par, sem score; score só quando o admin confirma", async () => {
    const emp = await usuario("mg_emp", "EMPREGADOR");
    const dia = await usuario("mg_dia", "DIARISTA");
    const admin = await usuario("mg_admin", "ADMIN");
    const srv = await servico("mg", emp, dia, "CANCELADO");
    const params = {
      servicoId: srv,
      motivo: "problema_seguranca",
      observacao: "relato do teste",
      reporterId: emp,
      reportedUserId: dia,
      acao: "CANCELADO",
    };

    await registrarMotivoGrave(params);
    await registrarMotivoGrave(params); // repetir o motivo não abre segunda denúncia

    const incidentes = await prisma.incidentReport.findMany({ where: { serviceId: srv, reportedUserId: dia } });
    assert.equal(incidentes.length, 1);
    const [inc] = incidentes;
    assert.deepEqual(
      {
        status: inc.status,
        gravidade: inc.gravidade,
        categoria: inc.categoria,
        type: inc.type,
        severity: inc.severity,
        subtipo: inc.subtipo,
        reportedById: inc.reportedById,
        resolucao: inc.resolucao,
      },
      {
        status: "ABERTO",
        gravidade: "ALTA",
        categoria: "OUTRO",
        type: "OUTRO",
        severity: "ALTA",
        subtipo: "problema_seguranca",
        reportedById: emp,
        resolucao: null,
      },
    );
    assert.match(inc.description, /problema_seguranca/);
    assert.deepEqual(
      await ledgers(dia),
      { legado: null, v2: null, eventosLegado: 0, eventosV2: 0 },
      "alegação sem revisão não mexe no score",
    );

    const r = await post(resolver, inc.id, admin, "ADMIN", { resolucao: "CONFIRMADA" });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(await ledgers(dia), { legado: 350, v2: 350, eventosLegado: 1, eventosV2: 1 });
    assert.deepEqual(
      await prisma.safeScoreEvent.findFirst({ where: { userId: dia }, select: { eventType: true, delta: true, sourceId: true } }),
      { eventType: "denuncia_confirmada", delta: -150, sourceId: inc.id },
    );

    const r2 = await post(resolver, inc.id, admin, "ADMIN", { resolucao: "CONFIRMADA" });
    assert.equal(r2.status, 200);
    assert.deepEqual(
      await ledgers(dia),
      { legado: 350, v2: 350, eventosLegado: 1, eventosV2: 1 },
      "resolver de novo não soma de novo",
    );
  });
});

// Encerra o pool do Prisma ao fim do arquivo. Sem isto, as conexões ociosas
// seguram o processo por ~10 s (pg-pool: idleTimeoutMillis = 10 s,
// allowExitOnIdle = false) — e sem prazo se uma conexão ficar presa numa
// transação de um teste que falhou.
after(async () => {
  await (globalThis as { prisma?: { $disconnect(): Promise<void> } }).prisma?.$disconnect();
});
