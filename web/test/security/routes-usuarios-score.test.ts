import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { makeAuthHeaders } from "./_helpers";

/**
 * GET /api/usuarios/[id]/score — quem pode ler a faixa de quem.
 *
 * A rota era aberta a qualquer conta autenticada. A regra fechada libera o
 * dono, ADMIN, qualquer um quando o alvo é profissional (é o que o empregador
 * vê antes de contratar) e, para alvo EMPREGADOR, só o profissional que tem
 * serviço com ele. Cada `it` abaixo é um dos fluxos reais do app ou uma das
 * leituras que deixaram de ser possíveis.
 */

const USUARIOS: Record<string, string> = {
  "u-emp": "EMPREGADOR",
  "u-emp2": "EMPREGADOR",
  "u-dia": "DIARISTA",
  "u-dia2": "DIARISTA",
  "u-mont": "MONTADOR",
  "u-admin": "ADMIN",
};

// u-emp contratou u-dia (diarista) e u-mont (montador). Ninguém mais tem vínculo.
const SERVICOS = [
  { clientId: "u-emp", diaristaId: "u-dia", montadorId: null },
  { clientId: "u-emp", diaristaId: null, montadorId: "u-mont" },
];

async function getScore(viewer: string | null, alvo: string) {
  const { GET } = await import("../../src/app/api/usuarios/[id]/score/route");
  const headers = viewer ? makeAuthHeaders(viewer, USUARIOS[viewer] as any) : {};
  const res = await GET(new Request(`http://test/api/usuarios/${alvo}/score`, { headers }), {
    params: Promise.resolve({ id: alvo }),
  });
  return { status: res.status, body: await res.json() };
}

describe("GET /api/usuarios/[id]/score — controle de acesso", () => {
  beforeEach(() => {
    resetMockPrisma();
    mockPrisma.user.findUnique = async (args: any) => {
      const role = USUARIOS[args?.where?.id];
      if (!role) return null;
      // Serve às duas consultas: a de status (assertContaAtiva) e a da rota.
      return { id: args.where.id, role, status: "ATIVO", diaristaProfile: null };
    };
    mockPrisma.safeScoreProfile.findUnique = async () => ({ currentScore: 720, tier: "GOLD" });
    mockPrisma.servico.count = async () => 0;
    (mockPrisma.servico as any).findFirst = async (args: any) => {
      const w = args?.where ?? {};
      const viewers = (w.OR ?? []).flatMap((c: any) => Object.values(c));
      const achou = SERVICOS.find(
        (s) =>
          s.clientId === w.clientId &&
          (viewers.includes(s.diaristaId) || viewers.includes(s.montadorId)),
      );
      return achou ? { id: "srv" } : null;
    };
  });

  it("401 sem token", async () => {
    const r = await getScore(null, "u-emp");
    assert.equal(r.status, 401);
  });

  // ── O IDOR: leituras que deixaram de ser possíveis ──────────────────────
  it("403: empregador lendo a faixa de OUTRO empregador", async () => {
    const r = await getScore("u-emp2", "u-emp");
    assert.equal(r.status, 403);
    assert.equal(r.body.faixa, undefined, "nada da faixa pode vazar no 403");
    assert.equal(r.body.bloqueado, undefined);
  });

  it("403: diarista SEM serviço com o empregador", async () => {
    const r = await getScore("u-dia2", "u-emp");
    assert.equal(r.status, 403);
    assert.equal(r.body.faixa, undefined);
  });

  it("403: ninguém além de ADMIN/dono lê a faixa de um ADMIN", async () => {
    const r = await getScore("u-dia", "u-admin");
    assert.equal(r.status, 403);
  });

  // ── Os fluxos do app que precisam continuar funcionando ─────────────────
  it("200: o próprio usuário (SafeScoreScreen / MontadorHome)", async () => {
    const r = await getScore("u-emp", "u-emp");
    assert.equal(r.status, 200);
    assert.equal(r.body.faixa, "Confiável");
  });

  it("200: ADMIN lê qualquer um", async () => {
    const r = await getScore("u-admin", "u-emp");
    assert.equal(r.status, 200);
  });

  it("200: empregador vê a diarista antes de contratar (useDiaristaPublico)", async () => {
    const r = await getScore("u-emp2", "u-dia");
    assert.equal(r.status, 200);
  });

  it("200: qualquer conta vê a faixa de um montador", async () => {
    const r = await getScore("u-emp2", "u-mont");
    assert.equal(r.status, 200);
  });

  it("200: diarista vê o cliente do próprio serviço (DiaristaDetalhe)", async () => {
    const r = await getScore("u-dia", "u-emp");
    assert.equal(r.status, 200);
  });

  it("200: montador vê o empregador da solicitação (useMontadorServicos)", async () => {
    const r = await getScore("u-mont", "u-emp");
    assert.equal(r.status, 200);
  });

  it("404 para id inexistente", async () => {
    const r = await getScore("u-emp", "u-nao-existe");
    assert.equal(r.status, 404);
  });

  it("a resposta liberada nunca traz o score bruto", async () => {
    const r = await getScore("u-emp", "u-emp");
    assert.equal(r.status, 200);
    assert.equal(r.body.score, undefined);
    assert.doesNotMatch(JSON.stringify(r.body), /720/);
  });
});
