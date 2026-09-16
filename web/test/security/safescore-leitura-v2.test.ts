import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { makeAuthHeaders } from "./_helpers";
import { diaristaDaBusca, montadorDaBusca, URL_BUSCA } from "./_perfisBusca";

/**
 * PR B, etapa 3: as leituras de score vêm só do V2.
 *
 * Antes, as seis leituras faziam perfil V2 → SafeScore legado → 500. O degrau
 * do legado saiu: sem perfil V2, a conta lê 500 direto. Aqui ficam fixados o
 * código (nenhuma consulta ao legado nos seis arquivos, e ninguém novo lendo o
 * legado) e o comportamento de uma conta nova, com o legado armado para
 * explodir se for consultado.
 */

const SRC = join(process.cwd(), "src");
const ler = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const LEITURAS = [
  "lib/safeScoreGuardian.ts",
  "app/api/diaristas/buscar/route.ts",
  "app/api/montadores/buscar/route.ts",
  "app/api/montadores/[id]/route.ts",
  "app/api/montador/me/route.ts",
  "app/api/usuarios/[id]/score/route.ts",
];

/** Consulta direta ao model legado, ou a relação `safeScore` num select/include. */
const CONSULTA_LEGADO = /\b(?:prisma|tx|db)\.safeScore\.|\bsafeScore:\s*(?:true\b|\{\s*select\b)/;

/** Quem ainda pode ler o legado, e por quê. Arquivo novo aqui é decisão explícita. */
const LEITORES_LEGADO: Record<string, string> = {
  "lib/safeScore.ts": "escrita dupla e gatilho de suspensão < 200 (decisão pendente)",
  "lib/safeScore/backfill.ts": "semeia o V2 a partir do legado",
};

function arquivosDe(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivosDe(caminho);
    return /\.(ts|tsx)$/.test(nome) ? [caminho] : [];
  });
}

describe("leituras de score — sem fallback legado (código)", () => {
  for (const rel of LEITURAS) {
    it(`${rel}: não consulta o legado`, () => {
      const codigo = ler(rel);
      assert.doesNotMatch(codigo, CONSULTA_LEGADO);
      assert.doesNotMatch(codigo, /\.safeScore\??\.score\b/, "leitura de campo do SafeScore legado");
      assert.match(codigo, /safeScoreProfile/, "a leitura tem que vir do V2");
    });
  }

  it("fora da lista revisada, ninguém lê o legado", () => {
    const achados = arquivosDe(SRC)
      .filter((arquivo) => CONSULTA_LEGADO.test(readFileSync(arquivo, "utf8")))
      .map((arquivo) => relative(SRC, arquivo))
      .sort();
    assert.deepEqual(achados, Object.keys(LEITORES_LEGADO).sort());
  });
});

describe("leituras de score — conta nova sem perfil V2 lê 500 sem tocar no legado", () => {
  let consultasLegado = 0;

  beforeEach(() => {
    resetMockPrisma();
    consultasLegado = 0;
    const armadilha = async () => {
      consultasLegado += 1;
      throw new Error("o SafeScore legado foi consultado");
    };
    mockPrisma.safeScore.findUnique = armadilha;
    mockPrisma.safeScore.findMany = armadilha;
  });

  it("Guardian: 500/BRONZE, sem score_baixo", async () => {
    mockPrisma.user.findUnique = async () => ({ id: "u-novo", role: "EMPREGADOR", status: "ATIVO" });
    mockPrisma.documentVerification.findFirst = async () => ({
      status: "APPROVED",
      docUrl: "verificacoes/u-novo/frente/abc.jpg",
    });
    mockPrisma.userRestriction.findMany = async () => [];
    mockPrisma.safeScoreProfile.findUnique = async () => null;

    const { getGuardianStatusForUser } = await import("../../src/lib/safeScoreGuardian");
    const g = await getGuardianStatusForUser("u-novo");

    assert.deepEqual({ score: g.score, tier: g.tier, scoreBaixo: g.motivos.includes("score_baixo") }, {
      score: 500,
      tier: "BRONZE",
      scoreBaixo: false,
    });
    assert.equal(consultasLegado, 0);
  });

  it("usuarios/[id]/score: faixa de 500", async () => {
    mockPrisma.user.findUnique = async (args: any) => ({
      id: args.where.id,
      role: "EMPREGADOR",
      status: "ATIVO",
      diaristaProfile: null,
    });
    mockPrisma.safeScoreProfile.findUnique = async () => null;
    mockPrisma.servico.count = async () => 0;

    const { GET } = await import("../../src/app/api/usuarios/[id]/score/route");
    const res = await GET(
      new Request("http://test/api/usuarios/u-novo/score", { headers: makeAuthHeaders("u-novo", "EMPREGADOR") }),
      { params: Promise.resolve({ id: "u-novo" }) },
    );
    const body = await res.json();

    assert.equal(res.status, 200, JSON.stringify(body));
    assert.deepEqual({ faixa: body.faixa, bloqueado: body.bloqueado, tier: body.tier }, {
      faixa: "Em Observação",
      bloqueado: false,
      tier: "BRONZE",
    });
    assert.equal(consultasLegado, 0);
  });

  it("montadores/buscar: aparece, e o select não pede a relação legada", async () => {
    let args: any;
    mockPrisma.montadorPerfil.findMany = async (a: any) => {
      args = a;
      return [montadorDaBusca("m-novo", null)];
    };

    const { GET } = await import("../../src/app/api/montadores/buscar/route");
    const body = await (await GET(new Request(`http://test/api/montadores/buscar?${URL_BUSCA}`))).json();

    assert.equal(body.montadores?.length, 1, JSON.stringify(body));
    assert.deepEqual(
      { faixa: body.montadores[0].safeScore.faixa, bloqueado: body.montadores[0].safeScore.bloqueado },
      { faixa: "Em Observação", bloqueado: false },
    );
    assert.equal(args.select.user.select.safeScore, undefined);
    assert.ok(args.select.user.select.safeScoreProfile);
    assert.equal(consultasLegado, 0);
  });

  it("montadores/[id]: faixa de 500, e o select não pede a relação legada", async () => {
    let args: any;
    (mockPrisma.montadorPerfil as any).findFirst = async (a: any) => {
      args = a;
      return montadorDaBusca("m-novo", null);
    };

    const { GET } = await import("../../src/app/api/montadores/[id]/route");
    const res = await GET(new Request("http://test/api/montadores/m-novo"), {
      params: Promise.resolve({ id: "m-novo" }),
    });
    const body = await res.json();

    assert.equal(res.status, 200, JSON.stringify(body));
    assert.deepEqual(
      { faixa: body.montador.safeScore.faixa, bloqueado: body.montador.safeScore.bloqueado },
      { faixa: "Em Observação", bloqueado: false },
    );
    assert.equal(args.select.user.select.safeScore, undefined);
    assert.equal(consultasLegado, 0);
  });

  it("diaristas/buscar: aparece sem perfil V2", async () => {
    mockPrisma.diaristaProfile.findMany = async () => [diaristaDaBusca("d-novo")];
    mockPrisma.safeScoreProfile.findMany = async () => [];

    const { GET } = await import("../../src/app/api/diaristas/buscar/route");
    const body = await (await GET(new Request(`http://test/api/diaristas/buscar?${URL_BUSCA}`))).json();

    assert.equal(body.diaristas?.length, 1, JSON.stringify(body));
    assert.equal(consultasLegado, 0);
  });

  // montador/me: coberto pela checagem de código acima e, com banco real, em
  // safescore-leitura-v2-db.test.ts (a rota depende de upsert e contagens que
  // o mock compartilhado não tem).
});

describe("resolver/ResolutionPanel — exibição separada do gatilho de suspensão", () => {
  it("exibição: a rota devolve o score do V2, não o retorno do legado", () => {
    const rota = ler("app/api/admin/incidentes/[id]/resolver/route.ts");
    assert.match(rota, /safeScoreProfile\.findUnique/);
    assert.doesNotMatch(rota, /=\s*await\s+aplicarEvento/, "o retorno de aplicarEvento é o SafeScore legado");
    assert.doesNotMatch(rota, CONSULTA_LEGADO);
  });

  it("exibição: o painel não deduz suspensão de score, lê o fato que a rota devolve", () => {
    const painel = ler("app/admin/(protected)/incidentes/[id]/ResolutionPanel.tsx");
    assert.doesNotMatch(painel, /score\s*<\s*\d/);
    assert.match(painel, /usuario\?\.suspensoAutomaticamente === true/);
  });

  it("gatilho: a suspensão abaixo de 200 continua no legado, nos dois caminhos de escrita (decisão pendente)", () => {
    // Mudar isto é a PR própria da auto-suspensão, não um efeito colateral do
    // corte de leituras. Se este teste quebrar, a decisão precisa ter sido tomada.
    const lib = ler("lib/safeScore.ts");
    const gatilhos = lib.match(/safeScore\.score\s*<\s*200\)\s*\{?\s*await suspenderUsuario\(/g) ?? [];
    assert.equal(gatilhos.length, 2);
  });
});
