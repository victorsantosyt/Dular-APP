import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { makeAuthHeaders } from "./_helpers";

/**
 * POST /api/servicos/[id]/confirmar contra Postgres REAL: concorrência,
 * consistência V2 × legado depois da confirmação e falha do legado.
 *
 * O achado que motivou: com V2 + legado + suspensão dentro da transação do
 * status, a transação ficava longa o bastante para estourar o timeout padrão
 * do Prisma (5 s) sob carga, e as requisições concorrentes recebiam 500 em vez
 * de 409. Sem carga o tempo fica em ~0,5 s e o teste simples passa até no
 * código antigo; por isso há uma variante com o legado deixado lento por um
 * gatilho no banco, que reproduz o estouro sem depender da máquina.
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

describe("confirmar serviço contra Postgres real", { skip: EXIGIDO ? false : PULAR }, () => {
  let prisma: any;
  let confirmar: Handler;

  const RUN = `t_sscc_${Date.now().toString(36)}`;
  const usuarios: string[] = [];
  const servicos: string[] = [];
  const gatilhos: string[] = [];

  async function usuario(sufixo: string, role: "EMPREGADOR" | "DIARISTA") {
    const id = `${RUN}_${sufixo}`;
    await prisma.user.create({ data: { id, nome: `Teste confirmar ${sufixo}`, role } });
    usuarios.push(id);
    return id;
  }

  async function servicoConcluido(sufixo: string, clientId: string, diaristaId: string) {
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
        status: "CONCLUIDO",
      },
    });
    servicos.push(id);
    return id;
  }

  /** Gatilho BEFORE INSERT em ScoreEvento (legado) só para o SafeScore destes usuários. */
  async function noLegadoDe(userIds: string[], acao: string) {
    const nome = `${RUN}_g${gatilhos.length}`;
    const lista = userIds.map((u) => `'${u}'`).join(",");
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION "${nome}_fn"() RETURNS trigger AS $f$ BEGIN IF NEW."safeScoreId" IN (SELECT id FROM "SafeScore" WHERE "userId" IN (${lista})) THEN ${acao}; END IF; RETURN NEW; END $f$ LANGUAGE plpgsql`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER "${nome}_trg" BEFORE INSERT ON "ScoreEvento" FOR EACH ROW EXECUTE FUNCTION "${nome}_fn"()`,
    );
    gatilhos.push(nome);
    return async () => {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${nome}_trg" ON "ScoreEvento"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${nome}_fn"()`);
      gatilhos.splice(gatilhos.indexOf(nome), 1);
    };
  }

  async function post(servicoId: string, empregador: string) {
    const res = await confirmar(
      new Request(`http://test/api/servicos/${servicoId}/confirmar`, {
        method: "POST",
        headers: { "content-type": "application/json", ...makeAuthHeaders(empregador, "EMPREGADOR") },
        body: "{}",
      }),
      { params: Promise.resolve({ id: servicoId }) },
    );
    return { status: res.status, body: await res.json().catch(() => null) };
  }

  /** N confirmações simultâneas; devolve os status na ordem de disparo. */
  async function simultaneas(n: number, servicoId: string, empregador: string) {
    return Promise.all(Array.from({ length: n }, () => post(servicoId, empregador)));
  }

  function conferirUmVencedor(respostas: Array<{ status: number; body: any }>) {
    const status = respostas.map((r) => r.status);
    assert.equal(status.filter((s) => s === 200).length, 1, `status reais: ${JSON.stringify(status)}`);
    assert.deepEqual([...status].sort(), [200, 409, 409, 409, 409], `status reais: ${JSON.stringify(status)}`);
    for (const r of respostas.filter((x) => x.status !== 200)) {
      assert.equal(r.body?.ok, false);
      assert.doesNotMatch(
        JSON.stringify(r.body),
        /transaction|prisma|timeout|ECONN|expired|stack/i,
        "detalhe interno vazando para o cliente",
      );
    }
  }

  const statusDo = async (id: string) => (await prisma.servico.findUnique({ where: { id } })).status;

  before(async () => {
    if (PULAR) throw new Error(`SAFESCORE_DB_REQUIRED=1, mas ${PULAR}`);
    process.env.DATABASE_URL = URL_BANCO;
    ({ prisma } = await import("../../src/lib/prisma"));
    confirmar = (await import("../../src/app/api/servicos/[id]/confirmar/route")).POST as Handler;
  });

  after(async () => {
    if (!prisma) return;
    for (const nome of [...gatilhos]) {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${nome}_trg" ON "ScoreEvento"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${nome}_fn"()`);
    }
    await prisma.servicoEvento.deleteMany({ where: { servicoId: { in: servicos } } });
    await prisma.notification.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.safeScoreEvent.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.safeScoreProfile.deleteMany({ where: { userId: { in: usuarios } } });
    const legados = await prisma.safeScore.findMany({ where: { userId: { in: usuarios } }, select: { id: true } });
    await prisma.scoreEvento.deleteMany({ where: { safeScoreId: { in: legados.map((l: any) => l.id) } } });
    await prisma.safeScore.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.servico.deleteMany({ where: { id: { in: servicos } } });
    await prisma.user.deleteMany({ where: { id: { in: usuarios } } });
    await prisma.$disconnect();
  });

  it("5 confirmações simultâneas do mesmo serviço: exatamente 1×200 e 4×409", async (t) => {
    const emp = await usuario("n_emp", "EMPREGADOR");
    const dia = await usuario("n_dia", "DIARISTA");
    const srv = await servicoConcluido("n", emp, dia);

    const respostas = await simultaneas(5, srv, emp);
    t.diagnostic(`status reais: ${JSON.stringify(respostas.map((r) => r.status))}`);

    conferirUmVencedor(respostas);
    assert.equal(await statusDo(srv), "CONFIRMADO");
  });

  it("legado lento (3 s por insert): a transação do status não espera o legado — 1×200 e 4×409", async (t) => {
    const emp = await usuario("l_emp", "EMPREGADOR");
    const dia = await usuario("l_dia", "DIARISTA");
    const srv = await servicoConcluido("l", emp, dia);
    const desfazer = await noLegadoDe([emp, dia], "PERFORM pg_sleep(3)");

    const inicio = Date.now();
    const respostas = await simultaneas(5, srv, emp);
    t.diagnostic(`status reais: ${JSON.stringify(respostas.map((r) => r.status))} em ${Date.now() - inicio} ms`);
    await desfazer();

    conferirUmVencedor(respostas);
    assert.equal(await statusDo(srv), "CONFIRMADO");
    for (const u of [emp, dia]) {
      const [v2, legado] = await Promise.all([
        prisma.safeScoreProfile.findUnique({ where: { userId: u } }),
        prisma.safeScore.findUnique({ where: { userId: u } }),
      ]);
      assert.deepEqual({ v2: v2?.currentScore, legado: legado?.score }, { v2: 505, legado: 505 }, u);
    }
  });

  it("depois da confirmação, V2 e legado batem para cliente e profissional", async () => {
    const emp = await usuario("c_emp", "EMPREGADOR");
    const dia = await usuario("c_dia", "DIARISTA");
    const srv = await servicoConcluido("c", emp, dia);

    const r = await post(srv, emp);
    assert.equal(r.status, 200, JSON.stringify(r.body));

    for (const u of [emp, dia]) {
      const eventosV2 = await prisma.safeScoreEvent.findMany({ where: { userId: u } });
      const legado = await prisma.safeScore.findUnique({ where: { userId: u } });
      const eventosLegado = legado ? await prisma.scoreEvento.findMany({ where: { safeScoreId: legado.id } }) : [];
      const perfil = await prisma.safeScoreProfile.findUnique({ where: { userId: u } });

      assert.equal(eventosV2.length, 1, u);
      assert.equal(eventosLegado.length, 1, u);
      const [v2] = eventosV2;
      const [leg] = eventosLegado;

      assert.deepEqual(
        { tipo: v2.eventType, delta: v2.delta, antes: v2.scoreBefore, depois: v2.scoreAfter, ref: v2.sourceId },
        { tipo: "servico_concluido", delta: 5, antes: 500, depois: 505, ref: srv },
        `V2 de ${u}`,
      );
      assert.deepEqual(
        { tipo: leg.tipo, peso: leg.peso, ref: leg.referenciaId, chave: leg.chaveIdempotencia },
        { tipo: "SERVICO_CONCLUIDO", peso: 5, ref: srv, chave: `SERVICO_CONCLUIDO:${srv}` },
        `legado de ${u}`,
      );
      // O mesmo fato nos dois ledgers: a chave do V2 é a do legado prefixada pelo usuário.
      assert.equal(v2.idempotencyKey, `${u}:${leg.chaveIdempotencia}`);
      assert.equal(v2.delta, leg.peso);
      assert.deepEqual({ v2: perfil.currentScore, legado: legado.score }, { v2: 505, legado: 505 }, u);
    }
  });

  it("falha no legado não derruba a confirmação: 200, erro logado com [confirmar] e o userId, V2 gravado", async () => {
    const emp = await usuario("f_emp", "EMPREGADOR");
    const dia = await usuario("f_dia", "DIARISTA");
    const srv = await servicoConcluido("f", emp, dia);
    const desfazer = await noLegadoDe([dia], "RAISE EXCEPTION 'falha injetada no legado'");

    const original = console.error;
    const logs: unknown[][] = [];
    console.error = (...args: unknown[]) => {
      logs.push(args);
    };
    let r: { status: number; body: any };
    try {
      r = await post(srv, emp);
    } finally {
      console.error = original;
      await desfazer();
    }

    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(await statusDo(srv), "CONFIRMADO");

    const doConfirmar = logs.filter((a) => String(a[0]).includes("[confirmar]"));
    assert.equal(doConfirmar.length, 1, `logs: ${JSON.stringify(logs.map((a) => String(a[0])))}`);
    const [, contexto] = doConfirmar[0] as [string, { userId: string; servicoId: string; error: unknown }];
    assert.equal(contexto.userId, dia);
    assert.equal(contexto.servicoId, srv);
    assert.match(String((contexto.error as Error)?.message), /falha injetada no legado/);

    // V2 do profissional gravado mesmo assim; legado dele não.
    assert.equal(await prisma.safeScoreEvent.count({ where: { userId: dia } }), 1);
    assert.equal((await prisma.safeScoreProfile.findUnique({ where: { userId: dia } })).currentScore, 505);
    assert.equal(await prisma.safeScore.findUnique({ where: { userId: dia } }), null);
    // O cliente, cujo legado não falhou, fica completo nos dois.
    assert.equal((await prisma.safeScore.findUnique({ where: { userId: emp } })).score, 505);
  });
});

// Encerra o pool do Prisma ao fim do arquivo. Sem isto, as conexões ociosas
// seguram o processo por ~10 s (pg-pool: idleTimeoutMillis = 10 s,
// allowExitOnIdle = false) — e sem prazo se uma conexão ficar presa numa
// transação de um teste que falhou.
after(async () => {
  await (globalThis as { prisma?: { $disconnect(): Promise<void> } }).prisma?.$disconnect();
});
