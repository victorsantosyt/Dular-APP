import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * SafeScore V2 contra Postgres REAL: idempotência, concorrência e o replay
 * dos eventos reais. Nada disso se prova com mock — a garantia vem da trava
 * de linha e do índice único do banco.
 *
 * Roda com SAFESCORE_DB_URL apontando para um Postgres LOCAL com as migrations
 * aplicadas. URL que não seja localhost é recusada: este teste cria e apaga
 * linhas.
 *
 * Sem a variável, a suíte é pulada — a menos que SAFESCORE_DB_REQUIRED=1. No CI
 * (security-tests.yml) ela é obrigatória: faltar banco reprova, não "pula".
 *
 *   SAFESCORE_DB_URL=postgresql://usuario@localhost:5432/dular npm run test:security
 */

const URL_BANCO = process.env.SAFESCORE_DB_URL;
const PULAR = !URL_BANCO
  ? "defina SAFESCORE_DB_URL (Postgres local com as migrations aplicadas)"
  : !/@(localhost|127\.0\.0\.1)[:/]/.test(URL_BANCO)
    ? "SAFESCORE_DB_URL não aponta para localhost — recusado"
    : false;
const EXIGIDO = process.env.SAFESCORE_DB_REQUIRED === "1";

type EventoReal = {
  usuario: string;
  tipo: string;
  pesoLegado: number;
  referencia: string;
  nota?: number;
  gravidade?: string;
};

describe("SafeScore V2 contra Postgres real", { skip: EXIGIDO ? false : PULAR }, () => {
  let prisma: any;
  let aplicarEvento: (u: string, t: any, r?: string, d?: string) => Promise<unknown>;
  let applyEvent: (i: any) => Promise<any>;

  const RUN = `t_ssv2_${Date.now().toString(36)}`;
  const usuarios: string[] = [];

  async function novoUsuario(sufixo: string) {
    const id = `${RUN}_${sufixo}`;
    await prisma.user.create({ data: { id, nome: `Teste SafeScore ${sufixo}` } });
    usuarios.push(id);
    return id;
  }

  const perfil = (userId: string) => prisma.safeScoreProfile.findUnique({ where: { userId } });

  before(async () => {
    if (PULAR) throw new Error(`SAFESCORE_DB_REQUIRED=1, mas ${PULAR}`);
    process.env.DATABASE_URL = URL_BANCO;
    ({ prisma } = await import("../../src/lib/prisma"));
    ({ aplicarEvento } = await import("../../src/lib/safeScore"));
    ({ applyEvent } = await import("../../src/lib/safeScore/applyEvent"));

    const ativa = await prisma.safeScorePolicyVersion.findFirst({
      where: { deprecatedAt: null },
      orderBy: { publishedAt: "desc" },
    });
    assert.equal(ativa?.version, "1.1.0", "a política ativa precisa ser a 1.1.0 — rode as migrations");
  });

  after(async () => {
    if (!prisma) return;
    await prisma.safeScoreEvent.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.safeScoreProfile.deleteMany({ where: { userId: { in: usuarios } } });
    const legados = await prisma.safeScore.findMany({ where: { userId: { in: usuarios } }, select: { id: true } });
    await prisma.scoreEvento.deleteMany({ where: { safeScoreId: { in: legados.map((l: any) => l.id) } } });
    await prisma.safeScore.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.user.deleteMany({ where: { id: { in: usuarios } } });
    await prisma.$disconnect();
  });

  it("idempotência: a mesma chamada duas vezes não duplica o efeito no V2", async () => {
    const u = await novoUsuario("idem");
    await aplicarEvento(u, "KYC_APROVADO", "doc-idem", "Documentos aprovados.");
    await aplicarEvento(u, "KYC_APROVADO", "doc-idem", "Documentos aprovados.");

    assert.equal((await perfil(u)).currentScore, 550);
    assert.equal(await prisma.safeScoreEvent.count({ where: { userId: u } }), 1);

    // O legado também conta uma vez só: a constraint (safeScoreId, chaveIdempotencia)
    // aborta a segunda gravação do mesmo fato. Antes dela, ele somava de novo (600).
    const legado = await prisma.safeScore.findUnique({ where: { userId: u } });
    assert.equal(legado.score, 550);
    assert.equal(await prisma.scoreEvento.count({ where: { safeScoreId: legado.id } }), 1);
  });

  it("idempotência direta: a segunda chamada devolve already_applied e não mexe no score", async () => {
    const u = await novoUsuario("idem2");
    const entrada = { userId: u, eventType: "denuncia_arquivada", source: "teste", idempotencyKey: `${u}:k` };
    assert.equal((await applyEvent(entrada)).status, "applied");
    assert.deepEqual(await applyEvent(entrada), { status: "already_applied" });
    assert.equal((await perfil(u)).currentScore, 510);
  });

  it("KYC_REJEITADO: a reprovação desconta -20 nos dois ledgers", async () => {
    const u = await novoUsuario("kycrej");
    await aplicarEvento(u, "KYC_REJEITADO", "doc-rejeitado", "Documento ilegível.");

    assert.equal((await prisma.safeScore.findUnique({ where: { userId: u } })).score, 480);
    assert.equal((await perfil(u)).currentScore, 480);
    assert.deepEqual(
      await prisma.safeScoreEvent.findFirst({ where: { userId: u }, select: { eventType: true, delta: true } }),
      { eventType: "kyc_rejeitado", delta: -20 },
    );
  });

  it("legado idempotente sob concorrência: 10 chamadas simultâneas do MESMO fato contam uma vez nos dois ledgers", async () => {
    const u = await novoUsuario("legconc");
    const resultados = await Promise.allSettled(
      Array.from({ length: 10 }, () => aplicarEvento(u, "KYC_APROVADO", "doc-conc", "Documentos aprovados.")),
    );
    assert.deepEqual(
      resultados.filter((r) => r.status === "rejected").map((r: any) => String(r.reason)),
      [],
      "nenhuma chamada repetida pode estourar erro",
    );

    const legado = await prisma.safeScore.findUnique({ where: { userId: u } });
    assert.equal(legado.score, 550);
    assert.equal(await prisma.scoreEvento.count({ where: { safeScoreId: legado.id } }), 1);
    assert.equal((await perfil(u)).currentScore, 550);
    assert.equal(await prisma.safeScoreEvent.count({ where: { userId: u } }), 1);
  });

  it("constraint: o banco recusa o mesmo fato duas vezes no mesmo SafeScore, e aceita fato diferente", async () => {
    const u = await novoUsuario("constraint");
    const s = await prisma.safeScore.create({ data: { userId: u, score: 500 } });
    const fato = {
      safeScoreId: s.id,
      tipo: "CANCELAMENTO",
      peso: -15,
      referenciaId: "srv-x",
      chaveIdempotencia: "CANCELAMENTO:srv-x",
    };
    await prisma.scoreEvento.create({ data: fato });
    await assert.rejects(prisma.scoreEvento.create({ data: fato }), (e: any) => e?.code === "P2002");
    await prisma.scoreEvento.create({ data: { ...fato, referenciaId: "srv-y", chaveIdempotencia: "CANCELAMENTO:srv-y" } });
    assert.equal(await prisma.scoreEvento.count({ where: { safeScoreId: s.id } }), 2);
  });

  it("fato repetido não reaplica a suspensão depois que o admin desbloqueou", async () => {
    const u = await novoUsuario("susp");
    await aplicarEvento(u, "DENUNCIA_CONFIRMADA", "inc-1", "gravidade=CRITICA"); // 500 → 200
    await aplicarEvento(u, "DENUNCIA_CONFIRMADA", "inc-2", "gravidade=CRITICA"); // 200 → 0: suspende
    assert.equal((await prisma.user.findUnique({ where: { id: u } })).status, "BLOQUEADO");

    await prisma.user.update({ where: { id: u }, data: { status: "ATIVO" } }); // admin desbloqueia
    await aplicarEvento(u, "DENUNCIA_CONFIRMADA", "inc-2", "gravidade=CRITICA"); // retentativa do mesmo fato

    assert.equal((await prisma.user.findUnique({ where: { id: u } })).status, "ATIVO");
    const legado = await prisma.safeScore.findUnique({ where: { userId: u } });
    assert.equal(await prisma.scoreEvento.count({ where: { safeScoreId: legado.id } }), 2);
  });

  it("concorrência: 20 eventos simultâneos para o mesmo usuário — nenhum se perde", async () => {
    const u = await novoUsuario("conc");
    const N = 20;
    const resultados = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        applyEvent({ userId: u, eventType: "servico_concluido", source: "teste", idempotencyKey: `${u}:c${i}` }),
      ),
    );
    assert.ok(resultados.every((r) => r.status === "applied"));
    assert.equal((await perfil(u)).currentScore, 500 + 5 * N);

    // Cada evento viu o score deixado pelo anterior: 505, 510, ... sem repetir.
    const eventos = await prisma.safeScoreEvent.findMany({
      where: { userId: u },
      select: { scoreBefore: true, scoreAfter: true },
      orderBy: { scoreAfter: "asc" },
    });
    assert.deepEqual(
      eventos.map((e: any) => e.scoreAfter),
      Array.from({ length: N }, (_, i) => 505 + 5 * i),
    );
    for (const e of eventos) assert.equal(e.scoreAfter - e.scoreBefore, 5);
  });

  it("concorrência com limite: 5 denúncias CRITICA simultâneas param em 0", async () => {
    const u = await novoUsuario("clamp");
    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        applyEvent({
          userId: u,
          eventType: "denuncia_confirmada",
          parametro: "CRITICA",
          source: "teste",
          idempotencyKey: `${u}:x${i}`,
        }),
      ),
    );
    assert.equal((await perfil(u)).currentScore, 0);
    const depois = await prisma.safeScoreEvent.findMany({ where: { userId: u }, select: { scoreAfter: true } });
    assert.deepEqual(depois.map((e: any) => e.scoreAfter).sort((a: number, b: number) => a - b), [0, 0, 0, 0, 200]);
  });

  it("replay dos 33 eventos reais pelo aplicarEvento: total por usuário bate com o legado", async () => {
    const fixture = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "test/security/fixtures/safescore-eventos-locais.json"), "utf8"),
    ) as { eventos: EventoReal[] };

    const ids = new Map<string, string>();
    for (const e of fixture.eventos) {
      if (!ids.has(e.usuario)) ids.set(e.usuario, await novoUsuario(`replay_${e.usuario}`));
    }

    // Na ordem histórica, pelo caminho de produção. A referência anonimizada
    // não existe em Avaliacao/IncidentReport, então nota e gravidade vêm da
    // descrição — o mesmo fallback que o legado usa.
    for (const e of fixture.eventos) {
      const descricao =
        e.nota !== undefined ? `nota=${e.nota}` : e.gravidade !== undefined ? `gravidade=${e.gravidade}` : undefined;
      await aplicarEvento(ids.get(e.usuario)!, e.tipo, e.referencia, descricao);
    }

    const vistos = new Set<string>();
    for (const [usuario, userId] of ids) {
      const deles = fixture.eventos.filter((e) => e.usuario === usuario);
      const somaLegado = deles.reduce((s, e) => s + e.pesoLegado, 0);
      const somaSemRepeticao = deles.reduce((s, e) => {
        const chave = `${e.tipo}:${e.referencia}`;
        if (vistos.has(`${usuario}:${chave}`)) return s;
        vistos.add(`${usuario}:${chave}`);
        return s + e.pesoLegado;
      }, 0);

      const legado = await prisma.safeScore.findUnique({ where: { userId } });
      const v2 = await perfil(userId);
      const deltas = await prisma.safeScoreEvent.aggregate({ where: { userId }, _sum: { delta: true } });

      // O fixture tem um fato repetido (KYC aprovado duas vezes, mesmo documento).
      // Com a constraint, o legado também conta uma vez: os dois ledgers terminam
      // iguais, e só o histórico gravado antes dela guarda a soma dupla.
      assert.ok(somaLegado >= somaSemRepeticao);
      assert.equal(legado.score, 500 + somaSemRepeticao, `${usuario}: legado diverge do esperado sem repetição`);
      assert.equal(v2.currentScore, 500 + somaSemRepeticao, `${usuario}: V2 diverge do legado`);
      assert.equal(deltas._sum.delta, somaSemRepeticao, `${usuario}: soma dos deltas V2`);
    }
  });
});
