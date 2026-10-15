import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { makeAuthHeaders } from "./_helpers";
import { readScorePresentation, countCompletedServices } from "../../src/lib/safeScore/presentation";
import { GET } from "../../src/app/api/me/safescore/route";

const request = (userId?: string, role: "DIARISTA" | "MONTADOR" | "EMPREGADOR" = "EMPREGADOR") => new Request(
  "http://test/api/me/safescore?userId=outro", { headers: userId ? makeAuthHeaders(userId, role) : {} },
);

beforeEach(() => {
  resetMockPrisma();
  mockPrisma.safeScoreProfile.findUnique = async () => ({ currentScore: 500, tier: "BRONZE" });
  mockPrisma.documentVerification.findFirst = async () => null;
  mockPrisma.servico.count = async () => 0;
  mockPrisma.userRestriction.findMany = async () => [];
});

describe("Apresentação do SafeScore", () => {
  it("deriva selo do score autoritativo, mesmo se tier persistido divergir", async () => {
    const score = await readScorePresentation("dono");
    assert.equal(score?.tier, "SILVER");
    assert.equal(score?.nivel, "Prata");
    assert.equal(score?.faixa, "Em Observação");
    assert.equal(Object.hasOwn(score!, "score"), false);
  });
  it("usa legado apenas na ausência de V2 e não cria score quando ambos faltam", async () => {
    mockPrisma.safeScoreProfile.findUnique = async () => null;
    mockPrisma.safeScore.findUnique = async () => ({ score: 900 });
    assert.equal((await readScorePresentation("dono"))?.tier, "PLATINUM");
    mockPrisma.safeScore.findUnique = async () => null;
    assert.equal(await readScorePresentation("dono"), null);
  });
  it("consulta todos os vínculos com os estados de conclusão das estatísticas", async () => {
    let query: unknown;
    mockPrisma.servico.count = async (args: unknown) => { query = args; return 3; };
    assert.equal(await countCompletedServices("dono"), 3);
    assert.deepEqual(query, { where: { status: { in: ["CONFIRMADO", "FINALIZADO"] },
      OR: [{ clientId: "dono" }, { diaristaId: "dono" }, { montadorId: "dono" }] } });
  });
  it("recusa ausência de autenticação", async () => assert.equal((await GET(request())).status, 401));
  it("recusa conta bloqueada", async () => {
    mockPrisma.user.findUnique = async () => ({ status: "BLOQUEADO" });
    assert.equal((await GET(request("dono"))).status, 403);
  });
  for (const role of ["EMPREGADOR", "DIARISTA", "MONTADOR"] as const) {
    it(`consulta somente o dono da sessão e a identidade real de ${role}`, async () => {
      const ids: string[] = [];
      mockPrisma.safeScoreProfile.findUnique = async ({ where }: any) => { ids.push(where.userId); return { currentScore: 700 }; };
      mockPrisma.user.findUnique = async () => ({ status: "ATIVO", emObservacao: true });
      mockPrisma.diaristaProfile.findUnique = async () => ({ verificacao: "VERIFICADO" });
      mockPrisma.montadorPerfil.findUnique = async () => ({ verificado: true });
      mockPrisma.documentVerification.findFirst = async () => ({ status: "APPROVED" });
      const res = await GET(request("dono", role));
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.deepEqual(ids, ["dono"]);
      assert.equal(body.identidade, "VERIFICADO");
      assert.equal(body.reputation.nivel, "Ouro");
      assert.equal(body.reputation.status, "Em Observação");
      assert.equal(JSON.stringify(body).includes('"currentScore"'), false);
    });
  }
  it("restrição prevalece sobre mensagem positiva da faixa", async () => {
    mockPrisma.safeScoreProfile.findUnique = async () => ({ currentScore: 900 });
    mockPrisma.userRestriction.findMany = async () => [{ type: "SUSPEND" }];
    const body = await (await GET(request("dono"))).json();
    assert.equal(body.reputation.status, "Conta com restrições");
    assert.match(body.reputation.mensagem, /limitações/);
  });
  it("restrição permanece visível mesmo sem histórico de score", async () => {
    mockPrisma.safeScoreProfile.findUnique = async () => null;
    mockPrisma.safeScore.findUnique = async () => null;
    mockPrisma.userRestriction.findMany = async () => [{ type: "BLOCK" }];
    const body = await (await GET(request("dono"))).json();
    assert.equal(body.reputation, null);
    assert.equal(body.status, "Conta com restrições");
    assert.match(body.mensagem, /limitações/);
  });
  it("montador reprovado retorna o mesmo estado no SafeScore e no fluxo de documentos", async () => {
    mockPrisma.user.findUnique = async () => ({ id: "dono", role: "MONTADOR", status: "ATIVO" });
    mockPrisma.montadorPerfil.findUnique = async () => ({ verificado: false, documentoFrente: "doc" });
    mockPrisma.documentVerification.findFirst = async () => ({ status: "REJECTED" });
    const overview = await (await GET(request("dono", "MONTADOR"))).json();
    const { GET: getMe } = await import("../../src/app/api/me/route");
    const me = await (await getMe(request("dono", "MONTADOR"))).json();
    assert.equal(overview.identidade, "REPROVADO");
    assert.equal(me.user.verificacao.status, "REPROVADO");
    assert.equal(me.user.docEnviado, true);
  });
  it("falha de banco é erro, nunca dados zerados", async () => {
    mockPrisma.servico.count = async () => { throw new Error("offline"); };
    const res = await GET(request("dono"));
    assert.equal(res.status, 500);
    assert.equal(Object.hasOwn(await res.json(), "totalServicos"), false);
  });
  for (const status of ["PENDING", "REJECTED", "APPROVED"] as const) {
    it(`preserva estado documental ${status}`, async () => {
      mockPrisma.documentVerification.findFirst = async () => ({ status, docUrl: "doc" });
      const body = await (await GET(request("dono"))).json();
      assert.equal(body.identidade, { PENDING: "PENDENTE", REJECTED: "REPROVADO", APPROVED: "VERIFICADO" }[status]);
    });
  }
});
