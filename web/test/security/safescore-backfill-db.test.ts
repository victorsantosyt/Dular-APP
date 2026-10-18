import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

/**
 * Backfill V2 ← legado contra Postgres REAL: escreve, é idempotente, deixa
 * evento de auditoria e sincroniza o tier. Mesmo protocolo de
 * safescore-ledger-db.test.ts: SAFESCORE_DB_URL local; obrigatório no CI
 * (SAFESCORE_DB_REQUIRED=1).
 */

const URL_BANCO = process.env.SAFESCORE_DB_URL;
const PULAR = !URL_BANCO
  ? "defina SAFESCORE_DB_URL (Postgres local com as migrations aplicadas)"
  : !/@(localhost|127\.0\.0\.1)[:/]/.test(URL_BANCO)
    ? "SAFESCORE_DB_URL não aponta para localhost — recusado"
    : false;
const EXIGIDO = process.env.SAFESCORE_DB_REQUIRED === "1";

describe("backfill SafeScore V2 contra Postgres real", { skip: EXIGIDO ? false : PULAR }, () => {
  let prisma: any;
  let bf: typeof import("../../src/lib/safeScore/backfill");

  const RUN = `t_ssbf_${Date.now().toString(36)}`;
  const ids = {
    qa: `${RUN}_qa`,
    baixo: `${RUN}_baixo`,
    soV2: `${RUN}_sov2`,
    igual: `${RUN}_igual`,
    liberado: `${RUN}_liberado`,
  };
  const todos = Object.values(ids);

  async function planoDosTestes() {
    const linhas = (await bf.coletarLinhas()).filter((l) => todos.includes(l.userId));
    return bf.planejarBackfill(linhas);
  }

  before(async () => {
    if (PULAR) throw new Error(`SAFESCORE_DB_REQUIRED=1, mas ${PULAR}`);
    process.env.DATABASE_URL = URL_BANCO;
    ({ prisma } = await import("../../src/lib/prisma"));
    bf = await import("../../src/lib/safeScore/backfill");

    for (const id of todos) await prisma.user.create({ data: { id, nome: `Teste backfill ${id}` } });

    // qa: legado 640 com eventos somando 20 (ajuste manual de +120) e V2 650.
    const qa = await prisma.safeScore.create({ data: { userId: ids.qa, score: 640 } });
    await prisma.scoreEvento.createMany({
      data: [
        { safeScoreId: qa.id, tipo: "SERVICO_CONCLUIDO", peso: 5, referenciaId: "s1", chaveIdempotencia: "SERVICO_CONCLUIDO:s1" },
        { safeScoreId: qa.id, tipo: "AVALIACAO_POSITIVA", peso: 15, referenciaId: "a1", chaveIdempotencia: "AVALIACAO_POSITIVA:a1" },
      ],
    });
    await prisma.safeScoreProfile.create({ data: { userId: ids.qa, currentScore: 650, tier: "GOLD" } });

    // baixo: legado 300, sem perfil V2.
    const baixo = await prisma.safeScore.create({ data: { userId: ids.baixo, score: 300 } });
    await prisma.scoreEvento.create({ data: { safeScoreId: baixo.id, tipo: "DENUNCIA_CONFIRMADA", peso: -200, referenciaId: "i1", chaveIdempotencia: "DENUNCIA_CONFIRMADA:i1" } });

    // liberado: legado 300 (baixo) mas perfil V2 em 505 — a leitura de hoje o
    // libera. Tem um serviço criado como cliente depois do perfil V2.
    const lib = await prisma.safeScore.create({ data: { userId: ids.liberado, score: 300 } });
    await prisma.scoreEvento.create({ data: { safeScoreId: lib.id, tipo: "DENUNCIA_CONFIRMADA", peso: -200, referenciaId: "i2", chaveIdempotencia: "DENUNCIA_CONFIRMADA:i2" } });
    await prisma.safeScoreProfile.create({ data: { userId: ids.liberado, currentScore: 505, tier: "SILVER" } });
    await prisma.servico.create({
      data: {
        id: `${RUN}_srv`,
        tipo: "FAXINA",
        data: new Date(),
        turno: "MANHA",
        cidade: "Agua Boa",
        uf: "MT",
        bairro: "Centro",
        precoFinal: 10000,
        clientId: ids.liberado,
      },
    });

    // soV2: perfil V2 sem legado — não pode ser tocado.
    await prisma.safeScoreProfile.create({ data: { userId: ids.soV2, currentScore: 505, tier: "SILVER" } });

    // igual: legado e V2 já em 550/SILVER, e o legado bate com os eventos (+50).
    const igual = await prisma.safeScore.create({ data: { userId: ids.igual, score: 550 } });
    await prisma.scoreEvento.create({ data: { safeScoreId: igual.id, tipo: "KYC_APROVADO", peso: 50, referenciaId: "k1", chaveIdempotencia: "KYC_APROVADO:k1" } });
    await prisma.safeScoreProfile.create({ data: { userId: ids.igual, currentScore: 550, tier: "SILVER" } });
  });

  after(async () => {
    if (!prisma) return;
    await prisma.servico.deleteMany({ where: { id: `${RUN}_srv` } });
    await prisma.safeScoreEvent.deleteMany({ where: { userId: { in: todos } } });
    await prisma.safeScoreProfile.deleteMany({ where: { userId: { in: todos } } });
    const legados = await prisma.safeScore.findMany({ where: { userId: { in: todos } }, select: { id: true } });
    await prisma.scoreEvento.deleteMany({ where: { safeScoreId: { in: legados.map((l: any) => l.id) } } });
    await prisma.safeScore.deleteMany({ where: { userId: { in: todos } } });
    await prisma.user.deleteMany({ where: { id: { in: todos } } });
    await prisma.$disconnect();
  });

  it("dry-run: planeja sem escrever", async () => {
    const plano = await planoDosTestes();
    const por = Object.fromEntries(plano.acoes.map((a) => [a.userId, a.acao]));
    assert.deepEqual(por, {
      [ids.qa]: "ATUALIZAR",
      [ids.baixo]: "CRIAR",
      [ids.soV2]: "SEM_LEGADO",
      [ids.igual]: "NADA",
      [ids.liberado]: "ATUALIZAR",
    });
    assert.deepEqual(
      plano.divergencias.map((d) => [d.userId, d.diferenca]),
      [[ids.qa, 120]],
    );
    assert.equal(await prisma.safeScoreEvent.count({ where: { userId: { in: todos } } }), 0);
  });

  it("auditoria: acha quem a leitura de hoje libera por engano e o que fez desde então", async () => {
    const plano = await planoDosTestes();
    assert.deepEqual(plano.liberadosIndevidamente.map((m) => m.userId), [ids.liberado]);
    assert.deepEqual(plano.bloqueadosIndevidamente, []);

    const [f] = await bf.coletarForense(plano.liberadosIndevidamente.map((m) => m.userId));
    assert.equal(f.userId, ids.liberado);
    assert.ok(f.perfilV2CriadoEm instanceof Date);
    assert.equal(f.eventosV2, 0);
    assert.equal(f.servicosCriadosComoCliente, 1);
    assert.equal(f.servicosComoProfissional, 0);
  });

  it("aplica: V2 = legado, tier recalculado, riskTier sincronizado, evento de auditoria", async () => {
    const r = await bf.executarBackfill(await planoDosTestes());
    assert.deepEqual(r, { semeados: 3, semMudanca: 0, falhas: [] });

    const qa = await prisma.safeScoreProfile.findUnique({ where: { userId: ids.qa } });
    assert.equal(qa.currentScore, 640);
    assert.equal(qa.tier, "SILVER");
    assert.equal((await prisma.user.findUnique({ where: { id: ids.qa } })).riskTier, "SILVER");

    const baixo = await prisma.safeScoreProfile.findUnique({ where: { userId: ids.baixo } });
    assert.equal(baixo.currentScore, 300);
    assert.equal(baixo.tier, "BRONZE");

    const eventos = await prisma.safeScoreEvent.findMany({
      where: { userId: { in: todos } },
      select: { userId: true, eventType: true, scoreBefore: true, scoreAfter: true, delta: true },
      orderBy: { userId: "asc" },
    });
    assert.deepEqual(
      eventos.map((e: any) => [e.userId, e.eventType, e.scoreBefore, e.scoreAfter, e.delta]),
      [
        [ids.baixo, "backfill_legado", 500, 300, -200],
        [ids.liberado, "backfill_legado", 505, 300, -205],
        [ids.qa, "backfill_legado", 650, 640, -10],
      ],
    );

    // Intocados.
    assert.equal((await prisma.safeScoreProfile.findUnique({ where: { userId: ids.soV2 } })).currentScore, 505);
    assert.equal((await prisma.safeScoreProfile.findUnique({ where: { userId: ids.igual } })).currentScore, 550);
  });

  it("idempotente: rodar de novo não planeja nem grava nada", async () => {
    const plano = await planoDosTestes();
    assert.equal(plano.contagem.CRIAR + plano.contagem.ATUALIZAR, 0);
    const r = await bf.executarBackfill(plano);
    assert.deepEqual(r, { semeados: 0, semMudanca: 0, falhas: [] });
    assert.equal(await prisma.safeScoreEvent.count({ where: { userId: { in: todos } } }), 3);
  });

  it("depois do backfill a leitura de hoje e a de depois coincidem para quem tem legado", async () => {
    const plano = await planoDosTestes();
    assert.deepEqual(plano.mudancasScoreBaixo, []);
  });
});

// Encerra o pool do Prisma ao fim do arquivo. Sem isto, as conexões ociosas
// seguram o processo por ~10 s (pg-pool: idleTimeoutMillis = 10 s,
// allowExitOnIdle = false) — e sem prazo se uma conexão ficar presa numa
// transação de um teste que falhou.
after(async () => {
  await (globalThis as { prisma?: { $disconnect(): Promise<void> } }).prisma?.$disconnect();
});
