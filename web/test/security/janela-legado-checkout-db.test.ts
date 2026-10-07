import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import pg from "pg";

/**
 * Janela de legado do checkout, registrada pelo build de produção
 * (scripts/janela-legado-checkout.mjs), contra Postgres REAL. A saúde da
 * produção é simulada; nenhuma rede.
 *
 * O que se prova:
 *  - deploy comum (o código no ar já grava a operação do checkout): nenhuma janela;
 *  - código anterior no ar (primeira implantação, volta de rollback): janela de
 *    `desde` = última presença do código atual até agora, em UTC;
 *  - saúde sem resposta: janela também, presa à presença;
 *  - fora de produção: nada; erro de banco: falha (o deploy para);
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

describe("janela de legado do checkout (build de produção) contra Postgres real", { skip: EXIGIDO ? false : PULAR }, () => {
  let registrar: (opcoes: Record<string, unknown>) => Promise<{ acao: string; noAr?: string; desde?: string | null; ate?: string }>;
  let banco: InstanceType<typeof pg.Client>;
  const RUN = `t_janela_${Date.now().toString(36)}`;
  const PRESENCA = `presenca_${RUN}`;
  const ids: string[] = [];

  const saude = (corpo: unknown, status = 200) => {
    const chamadas: string[] = [];
    const buscar = async (url: string) => {
      chamadas.push(url);
      return new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });
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
  const producao = { VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "dular.exemplo.invalid", DATABASE_URL_UNPOOLED: URL_BANCO };
  const janelas = async () => (await banco.query(`SELECT count(*)::int AS n FROM "StripeJanelaLegado"`)).rows[0].n as number;
  const ISO = `'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'`;
  const agoraUtc = async () => new Date((await banco.query(`SELECT to_char(now() AT TIME ZONE 'UTC', ${ISO}) AS t`)).rows[0].t);

  async function executar(opcoes: Record<string, unknown>) {
    const r = await registrar({ chavePresenca: PRESENCA, ...opcoes });
    if (r.acao === "janela_registrada") {
      const { rows } = await banco.query(`SELECT id FROM "StripeJanelaLegado" WHERE to_char(ate, ${ISO}) = $1 AND origem = $2`, [r.ate, r.noAr]);
      ids.push(...rows.map((x: { id: string }) => x.id));
    }
    return r;
  }

  before(async () => {
    if (PULAR) throw new Error(`SAFESCORE_DB_REQUIRED=1, mas ${PULAR}`);
    ({ registrarJanelaDeLegado: registrar } = await import("../../scripts/janela-legado-checkout.mjs"));
    banco = new pg.Client({ connectionString: URL_BANCO });
    await banco.connect();
  });

  after(async () => {
    if (!banco) return;
    if (ids.length) await banco.query(`DELETE FROM "StripeJanelaLegado" WHERE id = ANY($1)`, [ids]);
    await banco.query(`DELETE FROM "StripeMarco" WHERE chave = $1`, [PRESENCA]);
    await banco.end();
  });

  it("fora de produção: nada é consultado nem gravado", async () => {
    const { buscar, chamadas } = saude({ ok: true });
    const antes = await janelas();
    for (const VERCEL_ENV of ["preview", "development", undefined]) {
      assert.deepEqual(await executar({ env: { ...producao, VERCEL_ENV }, buscar }), { acao: "ignorado" });
    }
    assert.deepEqual(chamadas, []);
    assert.equal(await janelas(), antes);
  });

  it("deploy comum: a produção já grava a operação do checkout → nenhuma janela", async () => {
    const { buscar, chamadas } = saude({ ok: true, status: "ok", checkoutComOperacao: true });
    const antes = await janelas();
    const r = await executar({ env: producao, buscar });
    assert.deepEqual(r, { acao: "nenhuma", noAr: "com_operacao" });
    assert.deepEqual(chamadas, ["https://dular.exemplo.invalid/api/health"]);
    assert.equal(await janelas(), antes);
  });

  it("primeira implantação (código anterior no ar, nunca houve presença): janela sem limite inferior até agora, em UTC", async () => {
    await banco.query(`DELETE FROM "StripeMarco" WHERE chave = $1`, [PRESENCA]);
    const { buscar } = saude({ ok: true, status: "ok", ts: "2026-10-07T00:00:00.000Z" });
    const inicio = await agoraUtc();
    const r = await executar({ env: producao, buscar });
    const fim = await agoraUtc();
    assert.equal(r.acao, "janela_registrada");
    assert.equal(r.noAr, "anterior");
    assert.equal(r.desde, null);
    const ate = new Date(r.ate!);
    assert.ok(ate.getTime() >= inicio.getTime() && ate.getTime() <= fim.getTime(), "ate = agora, pelo relógio do banco em UTC");
    assert.ok(Math.abs(ate.getTime() - Date.now()) < 60_000, "e é a hora real (UTC), não deslocada pelo fuso");
  });

  it("volta depois de rollback: a janela começa na última presença do código atual", async () => {
    const presenca = new Date(Date.now() - 3 * 3600_000);
    await banco.query(
      `INSERT INTO "StripeMarco" (chave, em) VALUES ($1, $2) ON CONFLICT (chave) DO UPDATE SET em = EXCLUDED.em`,
      [PRESENCA, presenca.toISOString().replace("Z", "")],
    );
    const { buscar } = saude({ ok: true, status: "ok" });
    const r = await executar({ env: producao, buscar });
    assert.equal(r.acao, "janela_registrada");
    assert.equal(new Date(r.desde!).getTime(), presenca.getTime(), "desde = presença gravada");
    assert.ok(new Date(r.ate!).getTime() > presenca.getTime());
  });

  for (const [nome, opcoes] of [
    ["saúde fora do ar (3 tentativas)", { buscar: fora().buscar }],
    ["saúde com erro 503", { buscar: saude({ erro: true }, 503).buscar }],
    ["sem o domínio de produção", { env: { ...producao, VERCEL_PROJECT_PRODUCTION_URL: "" } }],
  ] as const) {
    it(`não dá para provar quem está no ar (${nome}): registra a janela, presa à última presença`, async () => {
      const r = await executar({ env: producao, ...opcoes });
      assert.equal(r.acao, "janela_registrada");
      assert.equal(r.noAr, "desconhecida");
      assert.match(String(r.desde), /^\d{4}-\d{2}-\d{2}T/, "limite inferior = presença do código atual");
    });
  }

  it("saúde fora do ar: tenta 3 vezes antes de concluir", async () => {
    const f = fora();
    await executar({ env: producao, buscar: f.buscar });
    assert.equal(f.chamadas.length, 3);
  });

  it("sem banco: falha (o deploy para e a versão no ar continua)", async () => {
    const { buscar } = saude({ ok: true });
    await assert.rejects(registrar({ env: { ...producao, DATABASE_URL_UNPOOLED: "" }, buscar, chavePresenca: PRESENCA }), /DATABASE_URL_UNPOOLED/);
    await assert.rejects(
      registrar({ env: { ...producao, DATABASE_URL_UNPOOLED: "postgresql://ninguem@127.0.0.1:1/nada" }, buscar, chavePresenca: PRESENCA }),
    );
  });

  it("a rota de saúde desta versão declara `checkoutComOperacao: true` — é o que o build consulta", async () => {
    const { GET } = await import("../../src/app/api/health/route");
    const corpo = await (await GET()).json();
    assert.equal(corpo.checkoutComOperacao, true);
    const { buscar } = saude(corpo);
    assert.equal((await executar({ env: producao, buscar })).acao, "nenhuma");
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
