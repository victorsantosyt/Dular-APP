import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { diaristaDaBusca, montadorDaBusca, URL_BUSCA } from "./_perfisBusca";
import { SCORE_BLOQUEIO, scoreBloqueado } from "../../src/lib/safeScore/corte";

/**
 * Corte de bloqueio do SafeScore (PR B, etapa 3): uma fonte só.
 *
 * O 400 estava copiado no Guardian, em diaristas/buscar e no
 * `getFaixa().bloqueado` de montadores/buscar. Aqui ficam fixados a escala em
 * que o número vale, a fonte única, e que os três pontos decidem igual nas
 * bordas, inclusive com o Float do V2 (399.5).
 */

const SRC = join(process.cwd(), "src");
const ler = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const BORDAS = [0, 199.5, 200, 399, 399.5, 399.999, 400, 400.001, 400.5, 401, 1000];

describe("corte de bloqueio — escala e fonte única", () => {
  it("escala da 1.1.0: 0 a 1000 começando em 500, igual nos dois ledgers", () => {
    const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
    assert.match(schema, /currentScore\s+Float\s+@default\(500\)/, "V2");
    assert.match(schema, /\bscore\s+Int\s+@default\(500\)/, "legado");
    assert.match(ler("lib/safeScore/applyEvent.ts"), /Math\.max\(0, Math\.min\(1000, somado\.currentScore\)\)/, "trava do V2");
    assert.match(ler("lib/safeScore.ts"), /Math\.max\(0, Math\.min\(1000, score\)\)/, "trava do legado");
    assert.ok(SCORE_BLOQUEIO > 0 && SCORE_BLOQUEIO < 1000);
  });

  it("a política 1.1.0 não carrega limiar: só pesos por evento", () => {
    const sql = readFileSync(
      join(process.cwd(), "prisma/migrations/20260913113500_safescore_politica_1_1_0/migration.sql"),
      "utf8",
    );
    const pesos = JSON.parse(sql.split("$pesos$")[1]);
    for (const [chave, valor] of Object.entries(pesos)) {
      assert.doesNotMatch(chave, /corte|limiar|bloque|threshold|cutoff/i);
      assert.ok(typeof valor === "number" || (typeof valor === "object" && valor !== null), chave);
    }
  });

  it("bordas: 399.5 e 399.999 bloqueiam; 400 e 400.001 não", () => {
    assert.deepEqual(
      [399.5, 399.999, 400, 400.001].map(scoreBloqueado),
      [true, true, false, false],
    );
  });

  it("getFaixa().bloqueado é o corte único em todas as bordas", async () => {
    const { getFaixa } = await import("../../src/lib/safeScore");
    for (const s of BORDAS) assert.equal(getFaixa(s).bloqueado, scoreBloqueado(s), `score ${s}`);
  });

  it("Guardian, diaristas/buscar, getFaixa e backfill importam o corte; sem 400 solto", () => {
    const semStatusHttp = (codigo: string) => codigo.replace(/status:\s*400/g, "");
    const importa = /from ["']@\/lib\/safeScore\/corte["']/;

    for (const rel of ["lib/safeScoreGuardian.ts", "app/api/diaristas/buscar/route.ts"]) {
      const codigo = ler(rel);
      assert.match(codigo, importa, rel);
      assert.doesNotMatch(semStatusHttp(codigo), /\b400\b/, rel);
    }

    const lib = ler("lib/safeScore.ts");
    assert.match(lib, importa);
    const corpoGetFaixa = lib.slice(lib.indexOf("export function getFaixa("));
    assert.match(corpoGetFaixa, /scoreBloqueado\(score\)/);
    assert.doesNotMatch(corpoGetFaixa, /\b400\b/);

    const busca = ler("app/api/montadores/buscar/route.ts");
    assert.doesNotMatch(semStatusHttp(busca), /\b400\b/);
    assert.match(busca, /getFaixa\(score\)/);
    assert.match(busca, /m\.safeScore\.bloqueado === false/);

    assert.match(ler("lib/safeScore/backfill.ts"), /from ['"]@\/lib\/safeScore\/corte['"]/);
  });
});

describe("corte de bloqueio — os três pontos decidem igual nas bordas", () => {
  beforeEach(() => resetMockPrisma());

  for (const s of BORDAS) {
    it(`score ${s}: ${scoreBloqueado(s) ? "todos bloqueiam" : "todos liberam"}`, async () => {
      mockPrisma.user.findUnique = async () => ({ id: "u", role: "EMPREGADOR", status: "ATIVO" });
      mockPrisma.documentVerification.findFirst = async () => ({
        status: "APPROVED",
        docUrl: "verificacoes/u/frente/abc.jpg",
      });
      mockPrisma.userRestriction.findMany = async () => [];
      mockPrisma.safeScoreProfile.findUnique = async () => ({ currentScore: s, tier: "SILVER" });
      const { getGuardianStatusForUser } = await import("../../src/lib/safeScoreGuardian");
      const guardian = (await getGuardianStatusForUser("u")).motivos.includes("score_baixo");

      mockPrisma.diaristaProfile.findMany = async () => [diaristaDaBusca("d")];
      mockPrisma.safeScoreProfile.findMany = async () => [{ userId: "d", currentScore: s }];
      const diaristasGET = (await import("../../src/app/api/diaristas/buscar/route")).GET;
      const d = await (await diaristasGET(new Request(`http://test/api/diaristas/buscar?${URL_BUSCA}`))).json();

      mockPrisma.montadorPerfil.findMany = async () => [montadorDaBusca("m", { currentScore: s, tier: "SILVER" })];
      const montadoresGET = (await import("../../src/app/api/montadores/buscar/route")).GET;
      const m = await (await montadoresGET(new Request(`http://test/api/montadores/buscar?${URL_BUSCA}`))).json();

      // Resposta de erro não pode contar como "liberou" nem como "bloqueou":
      // sem a lista, a busca falhou.
      assert.ok(Array.isArray(d.diaristas), `diaristas/buscar falhou: ${JSON.stringify(d)}`);
      assert.ok(Array.isArray(m.montadores), `montadores/buscar falhou: ${JSON.stringify(m)}`);

      const esperado = scoreBloqueado(s);
      assert.deepEqual(
        { guardian, diaristas: d.diaristas.length === 0, montadores: m.montadores.length === 0 },
        { guardian: esperado, diaristas: esperado, montadores: esperado },
      );
    });
  }
});
