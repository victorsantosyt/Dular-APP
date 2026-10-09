import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import pg from "pg";

/**
 * Janela de legado do checkout, registrada pelo build de produção
 * (scripts/janela-legado-checkout.mjs), contra Postgres REAL. A saúde da
 * produção é simulada; nenhuma rede.
 *
 * O script roda num SCHEMA PRÓPRIO desta suíte (cópia das tabelas): as janelas
 * que ele abre — abertas até a troca real — não vazam para as outras suítes,
 * que rodam ao mesmo tempo no mesmo banco.
 *
 * O que se prova:
 *  - deploy comum (o código no ar já grava a operação do checkout): nenhuma janela;
 *  - a resposta EXATA do código anterior: janela ABERTA desde a última presença
 *    verificada do código atual, registrada em UTC;
 *  - qualquer outra resposta (HTML, JSON de outra forma, erro, rede): nenhuma
 *    janela e o deploy para; com a liberação explícita, publica sem janela;
 *  - fora de produção: nada; erro de banco: falha;
 *  - a ordem no vercel-build.sh: migration antes do build, janela só depois
 *    do build que terminou, e só em produção.
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

type Resultado = { acao: string; noAr?: string; desde?: string | null; aberta?: string };

describe("janela de legado do checkout (build de produção) contra Postgres real", { skip: EXIGIDO ? false : PULAR }, () => {
  let registrar: (opcoes: Record<string, unknown>) => Promise<Resultado>;
  let banco: InstanceType<typeof pg.Client>;
  const SCHEMA = `janela_${Date.now().toString(36)}`;
  const PRESENCA = "presenca_checkout_com_operacao";

  const resposta = (corpo: unknown, status = 200) => {
    const chamadas: string[] = [];
    const buscar = async (url: string) => {
      chamadas.push(url);
      return new Response(typeof corpo === "string" ? corpo : JSON.stringify(corpo), { status });
    };
    return { buscar, chamadas };
  };
  const fora = () => {
    const chamadas: string[] = [];
    const buscar = async (url: string) => {
      chamadas.push(url);
      throw new Error("rede fora (simulado)");
    };
    return { buscar, chamadas };
  };
  /** A saúde do código anterior, exatamente como ela sempre foi. */
  const anterior = () => resposta({ ok: true, status: "ok", ts: new Date().toISOString() });
  const producao = { VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "dular.exemplo.invalid", DATABASE_URL_UNPOOLED: URL_BANCO };
  const conectar = (url: string) => new pg.Client({ connectionString: url, options: `-c search_path=${SCHEMA}` });
  const janelas = async () =>
    (await banco.query(`SELECT desde, ate, origem FROM "${SCHEMA}"."StripeJanelaLegado" ORDER BY "createdAt"`)).rows as Array<{
      desde: Date | null;
      ate: Date | null;
      origem: string;
    }>;
  const ISO = `'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'`;
  const agoraUtc = async () => new Date((await banco.query(`SELECT to_char(now() AT TIME ZONE 'UTC', ${ISO}) AS t`)).rows[0].t);

  const executar = (opcoes: Record<string, unknown>) => registrar({ conectar, ...opcoes });

  before(async () => {
    if (PULAR) throw new Error(`SAFESCORE_DB_REQUIRED=1, mas ${PULAR}`);
    ({ registrarJanelaDeLegado: registrar } = await import("../../scripts/janela-legado-checkout.mjs"));
    banco = new pg.Client({ connectionString: URL_BANCO });
    await banco.connect();
    await banco.query(`CREATE SCHEMA "${SCHEMA}"`);
    await banco.query(`CREATE TABLE "${SCHEMA}"."StripeJanelaLegado" (LIKE public."StripeJanelaLegado" INCLUDING ALL)`);
    await banco.query(`CREATE TABLE "${SCHEMA}"."StripeMarco" (LIKE public."StripeMarco" INCLUDING ALL)`);
  });

  beforeEach(async () => {
    if (!banco) return;
    await banco.query(`DELETE FROM "${SCHEMA}"."StripeJanelaLegado"`);
    await banco.query(`DELETE FROM "${SCHEMA}"."StripeMarco"`);
  });

  after(async () => {
    if (!banco) return;
    await banco.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await banco.end();
  });

  it("fora de produção: nada é consultado nem gravado", async () => {
    const { buscar, chamadas } = anterior();
    for (const VERCEL_ENV of ["preview", "development", undefined]) {
      assert.deepEqual(await executar({ env: { ...producao, VERCEL_ENV }, buscar }), { acao: "ignorado" });
    }
    assert.deepEqual(chamadas, []);
    assert.deepEqual(await janelas(), []);
  });

  it("deploy comum: a produção já grava a operação do checkout → nenhuma janela", async () => {
    const { buscar, chamadas } = resposta({ ok: true, status: "ok", ts: "2026-10-07T00:00:00.000Z", checkoutComOperacao: true, implantacao: "dpl_x" });
    assert.deepEqual(await executar({ env: producao, buscar }), { acao: "nenhuma", noAr: "com_operacao" });
    assert.deepEqual(chamadas, ["https://dular.exemplo.invalid/api/health"]);
    assert.deepEqual(await janelas(), []);
  });

  it("primeira implantação (resposta exata do código anterior, nunca houve presença): janela ABERTA, sem limite inferior, registrada em UTC", async () => {
    const inicio = await agoraUtc();
    const r = await executar({ env: producao, buscar: anterior().buscar });
    const fim = await agoraUtc();
    assert.equal(r.acao, "janela_registrada");
    assert.equal(r.noAr, "anterior");
    assert.equal(r.desde, null);
    const aberta = new Date(r.aberta!);
    assert.ok(aberta >= inicio && aberta <= fim, "registrada agora, pelo relógio do banco");
    assert.ok(Math.abs(aberta.getTime() - Date.now()) < 60_000, "em UTC, não deslocada pelo fuso");
    const [j] = await janelas();
    assert.deepEqual([j.desde, j.ate, j.origem], [null, null, "anterior"], "aberta: quem fecha é a troca real");
  });

  it("volta depois de rollback: a janela começa na última presença verificada do código atual", async () => {
    const presenca = new Date(Date.now() - 3 * 3600_000);
    await banco.query(`INSERT INTO "${SCHEMA}"."StripeMarco" (chave, em) VALUES ($1, $2)`, [PRESENCA, presenca.toISOString().replace("Z", "")]);
    const r = await executar({ env: producao, buscar: anterior().buscar });
    assert.equal(r.acao, "janela_registrada");
    assert.equal(new Date(r.desde!).getTime(), presenca.getTime());
    assert.equal((await janelas())[0].ate, null);
  });

  for (const [nome, fabrica] of [
    ["200 com HTML", () => resposta("<html>ok</html>")],
    ["200 com JSON de outra forma ({})", () => resposta({})],
    ["200 sem `ts`", () => resposta({ ok: true, status: "ok" })],
    ["200 com `ts` inválido", () => resposta({ ok: true, status: "ok", ts: "ontem" })],
    ["200 com campo a mais", () => resposta({ ok: true, status: "ok", ts: new Date().toISOString(), versao: 2 })],
    ["200 com `checkoutComOperacao: false`", () => resposta({ ok: true, status: "ok", ts: new Date().toISOString(), checkoutComOperacao: false })],
    ["503", () => resposta({ ok: false }, 503)],
    ["rede fora", () => fora()],
  ] as const) {
    it(`saúde não identifica o código no ar (${nome}): NENHUMA janela e o deploy para`, async () => {
      await banco.query(`INSERT INTO "${SCHEMA}"."StripeMarco" (chave, em) VALUES ($1, now() AT TIME ZONE 'UTC')`, [PRESENCA]);
      await assert.rejects(executar({ env: producao, buscar: fabrica().buscar }), /não identificou o código no ar/);
      assert.deepEqual(await janelas(), []);
    });
  }

  it("sem o domínio de produção: também não identifica — nenhuma janela e o deploy para", async () => {
    await assert.rejects(executar({ env: { ...producao, VERCEL_PROJECT_PRODUCTION_URL: "" }, buscar: anterior().buscar }), /não identificou/);
    assert.deepEqual(await janelas(), []);
  });

  it("saúde fora do ar: tenta 3 vezes antes de concluir", async () => {
    const f = fora();
    await assert.rejects(executar({ env: producao, buscar: f.buscar }));
    assert.equal(f.chamadas.length, 3);
  });

  it("liberação explícita de emergência: publica SEM janela", async () => {
    const r = await executar({ env: { ...producao, JANELA_LEGADO_SAUDE_DESCONHECIDA: "prosseguir" }, buscar: fora().buscar });
    assert.deepEqual(r, { acao: "sem_janela", noAr: "desconhecida" });
    assert.deepEqual(await janelas(), []);
  });

  it("sem banco: falha (o deploy para e a versão no ar continua)", async () => {
    await assert.rejects(executar({ env: { ...producao, DATABASE_URL_UNPOOLED: "" }, buscar: anterior().buscar }), /DATABASE_URL_UNPOOLED/);
    await assert.rejects(executar({ env: { ...producao, DATABASE_URL_UNPOOLED: "postgresql://ninguem@127.0.0.1:1/nada" }, buscar: anterior().buscar }));
  });

  it("a rota de saúde desta versão declara `checkoutComOperacao: true` e a implantação no ar — é o que o build e a presença consultam", async () => {
    const original = process.env.VERCEL_DEPLOYMENT_ID;
    process.env.VERCEL_DEPLOYMENT_ID = "dpl_saude";
    try {
      const { GET } = await import("../../src/app/api/health/route");
      const corpo = await (await GET()).json();
      assert.equal(corpo.checkoutComOperacao, true);
      assert.equal(corpo.implantacao, "dpl_saude");
      assert.deepEqual(await executar({ env: producao, buscar: resposta(corpo).buscar }), { acao: "nenhuma", noAr: "com_operacao" });
    } finally {
      if (original === undefined) delete process.env.VERCEL_DEPLOYMENT_ID;
      else process.env.VERCEL_DEPLOYMENT_ID = original;
    }
  });

  it("vercel-build.sh: migration ANTES do build; janela só DEPOIS do build e só em produção", () => {
    const script = readFileSync(new URL("../../scripts/vercel-build.sh", import.meta.url), "utf8");
    const linhas = script.split("\n").map((l) => l.trim());
    const migra = linhas.findIndex((l) => l.includes("npx prisma migrate deploy"));
    const build = linhas.findIndex((l) => l === "npm run build");
    const janela = linhas.findIndex((l) => l === "node scripts/janela-legado-checkout.mjs");
    assert.ok(migra >= 0 && build > migra, "migrate deploy antes do build");
    assert.ok(janela > build, "janela depois do build");
    assert.equal(linhas[janela - 1], 'if [ "$ambiente" = "production" ]; then', "só em produção");
    assert.match(script, /set -euo pipefail/, "falha da janela derruba o deploy");
  });
});
