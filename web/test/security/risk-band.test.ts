import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { recomputeRiskForUser, riskBandFromScore } from "../../src/lib/risk";

/**
 * `User.riskTier` era gravado por dois lugares com sentidos opostos:
 * applyEvent.ts (PLATINUM = mais confiável) e lib/risk.ts (riskScore alto →
 * PLATINUM, ou seja, mais risco = "melhor" tier). Quem gravasse por último
 * decidia o significado. O risco por incidentes agora vai para `riskBand`.
 */

describe("riskBandFromScore — mesmos cortes, sentido certo", () => {
  const casos: Array<[number, string]> = [
    [0, "BAIXO"],
    [19, "BAIXO"],
    [20, "MEDIO"],
    [49, "MEDIO"],
    [50, "ALTO"],
    [79, "ALTO"],
    [80, "CRITICO"],
    [400, "CRITICO"],
  ];
  for (const [score, faixa] of casos) {
    it(`riskScore ${score} → ${faixa}`, () => {
      assert.equal(riskBandFromScore(score), faixa);
    });
  }
});

describe("recomputeRiskForUser — não toca em riskTier", () => {
  beforeEach(() => resetMockPrisma());

  it("grava riskScore e riskBand, e nada em riskTier", async () => {
    (mockPrisma as any).incidentReport.findMany = async () => [
      { status: "CONFIRMADO" },
      { status: "CONFIRMADO" },
      { status: "ABERTO" },
    ];
    let data: Record<string, unknown> | null = null;
    mockPrisma.user.update = async (args: any) => {
      data = args.data;
      return {};
    };

    await recomputeRiskForUser("u-1");

    assert.deepEqual(data, { riskScore: 100, riskBand: "CRITICO" });
  });
});

describe("estrutural — riskTier tem um único escritor", () => {
  // Varre o diretório, não uma lista: escritor novo em arquivo novo também reprova.
  it("só lib/safeScore/applyEvent.ts escreve `riskTier:`", () => {
    const raiz = path.join(process.cwd(), "src");
    const escritores: string[] = [];
    const visitar = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) visitar(p);
        else if (/\.(ts|tsx)$/.test(e.name) && /\briskTier\s*:/.test(fs.readFileSync(p, "utf8"))) {
          escritores.push(path.relative(raiz, p).split(path.sep).join("/"));
        }
      }
    };
    visitar(raiz);
    assert.deepEqual(escritores, ["lib/safeScore/applyEvent.ts"]);
  });
});
