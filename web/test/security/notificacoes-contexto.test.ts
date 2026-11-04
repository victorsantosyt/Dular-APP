import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { makeAuthHeaders, jsonRequest } from "./_helpers";
import { relacaoDoAviso, type EnvioComDecisoes } from "../../src/lib/contextoAvisoVerificacao";

const t = (iso: string) => new Date(iso);

function envio(id: string, criado: string, decisoes: Array<[string, string, string]>, decidido?: string): EnvioComDecisoes {
  return {
    id,
    createdAt: t(criado),
    decididoEm: decidido ? t(decidido) : decisoes.length ? t(decisoes[decisoes.length - 1][2]) : null,
    decisoes: decisoes.map(([did, decisao, em]) => ({ id: did, decisao, createdAt: t(em) })),
  };
}

describe("relacaoDoAviso — vínculo explícito e avisos antigos", () => {
  const envios = () => [
    envio("e1", "2026-10-01T10:00:00Z", [["d1", "REENVIO", "2026-10-02T10:00:00.000Z"]]),
    envio("e2", "2026-10-03T10:00:00Z", [
      ["d2", "APROVADO", "2026-10-04T10:00:00.000Z"],
      ["d3", "REPROVADO", "2026-10-04T10:00:00.300Z"], // revisão 300 ms depois
    ]),
  ];

  it("vínculo explícito: envio anterior, decisão superada (revisão rápida) e vigente", () => {
    const t0 = t("2026-10-04T10:00:00.400Z");
    assert.deepEqual(relacaoDoAviso({ type: "VERIFICACAO_REPROVADA", createdAt: t0, verificacaoId: "e1", decisaoVerificacaoId: "d1" }, envios()), {
      relacao: "ENVIO_ANTERIOR", vinculo: "EXPLICITO", decisaoDoAviso: "REENVIO",
    });
    assert.deepEqual(relacaoDoAviso({ type: "VERIFICACAO_APROVADA", createdAt: t0, verificacaoId: "e2", decisaoVerificacaoId: "d2" }, envios()), {
      relacao: "SUPERADA", vinculo: "EXPLICITO", decisaoDoAviso: "APROVADO",
    });
    assert.deepEqual(relacaoDoAviso({ type: "VERIFICACAO_REPROVADA", createdAt: t0, verificacaoId: "e2", decisaoVerificacaoId: "d3" }, envios()), {
      relacao: "VIGENTE", vinculo: "EXPLICITO", decisaoDoAviso: "REPROVADO",
    });
  });

  it("vínculo para envio/decisão que não é da conta (fora da lista): indeterminada, sem revelar nada", () => {
    assert.deepEqual(relacaoDoAviso({ type: "VERIFICACAO_APROVADA", createdAt: t("2026-10-05T00:00:00Z"), verificacaoId: "e-alheio", decisaoVerificacaoId: "d-alheia" }, envios()), {
      relacao: "INDETERMINADA", vinculo: "SEM_VINCULO", decisaoDoAviso: null,
    });
    // Decisão de um envio da conta, mas id de decisão que não é dele.
    assert.equal(relacaoDoAviso({ type: "VERIFICACAO_APROVADA", createdAt: t("2026-10-05T00:00:00Z"), verificacaoId: "e2", decisaoVerificacaoId: "d1" }, envios()).relacao, "INDETERMINADA");
  });

  it("aviso antigo sem vínculo no mesmo instante de uma decisão: NÃO é casado com ela", () => {
    const r = relacaoDoAviso({ type: "VERIFICACAO_REPROVADA", createdAt: t("2026-10-04T10:00:00.350Z") }, envios());
    assert.deepEqual(r, { relacao: "INDETERMINADA", vinculo: "SEM_VINCULO", decisaoDoAviso: null });
  });

  it("aviso antigo anterior ao envio atual: envio anterior, sem nomear a decisão", () => {
    assert.deepEqual(relacaoDoAviso({ type: "VERIFICACAO_REPROVADA", createdAt: t("2026-10-02T10:00:00.100Z") }, envios()), {
      relacao: "ENVIO_ANTERIOR", vinculo: "SEM_VINCULO", decisaoDoAviso: null,
    });
  });

  it("aviso antigo bem anterior à decisão vigente do mesmo envio: superada, sem nomear a decisão", () => {
    const so = [envio("e1", "2026-10-01T10:00:00Z", [["d1", "APROVADO", "2026-10-01T12:00:00Z"], ["d2", "REPROVADO", "2026-10-05T12:00:00Z"]], "2026-10-05T12:00:00Z")];
    assert.deepEqual(relacaoDoAviso({ type: "VERIFICACAO_APROVADA", createdAt: t("2026-10-01T12:00:01Z") }, so), {
      relacao: "SUPERADA", vinculo: "SEM_VINCULO", decisaoDoAviso: null,
    });
  });

  it("sem envios ou tipo de outro assunto: indeterminada", () => {
    assert.equal(relacaoDoAviso({ type: "VERIFICACAO_APROVADA", createdAt: t("2026-10-01T09:00:00Z") }, []).relacao, "INDETERMINADA");
    assert.equal(relacaoDoAviso({ type: "SERVICO_ACEITO", createdAt: t("2026-10-01T09:00:00Z") }, envios()).relacao, "INDETERMINADA");
  });
});

async function getGET() {
  const mod = await import("../../src/app/api/notificacoes/[id]/contexto/route");
  return mod.GET;
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const get = (id: string, headers: Record<string, string> = {}) =>
  new Request(`http://test/api/notificacoes/${id}/contexto`, { method: "GET", headers });

describe("GET /api/notificacoes/[id]/contexto", () => {
  beforeEach(() => resetMockPrisma());

  it("401 sem token", async () => {
    const GET = await getGET();
    const res = await GET(jsonRequest("http://test/api/notificacoes/n1/contexto", null), ctx("n1"));
    assert.equal(res.status, 401);
  });

  it("aviso de outra conta responde 404 e não consulta verificações", async () => {
    mockPrisma.notification.findUnique = async () => ({ id: "n1", userId: "u-outro", type: "VERIFICACAO_APROVADA", createdAt: new Date(), readAt: null });
    let consultou = false;
    (mockPrisma.documentVerification as any).findMany = async () => {
      consultou = true;
      return [];
    };
    const GET = await getGET();
    const res = await GET(get("n1", makeAuthHeaders("u-dono", "DIARISTA")), ctx("n1"));
    assert.equal(res.status, 404);
    assert.equal(consultou, false);
  });

  it("aviso de verificação: relação calculada só com os envios do dono", async () => {
    mockPrisma.notification.findUnique = async () => ({
      id: "n1",
      userId: "u-dono",
      type: "VERIFICACAO_REPROVADA",
      createdAt: t("2026-10-02T10:00:00.100Z"),
      readAt: null,
      verificacaoId: "e1",
      decisaoVerificacaoId: "d1",
    });
    let where: any = null;
    (mockPrisma.documentVerification as any).findMany = async (args: any) => {
      where = args.where;
      return [
        envio("e1", "2026-10-01T10:00:00Z", [["d1", "REENVIO", "2026-10-02T10:00:00.000Z"]]),
        envio("e2", "2026-10-03T10:00:00Z", [["d2", "APROVADO", "2026-10-04T10:00:00.000Z"]]),
      ];
    };
    const GET = await getGET();
    const res = await GET(get("n1", makeAuthHeaders("u-dono", "MONTADOR")), ctx("n1"));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(where.userId, "u-dono");
    assert.deepEqual(body.verificacao, { relacao: "ENVIO_ANTERIOR", vinculo: "EXPLICITO", decisaoDoAviso: "REENVIO" });
  });

  it("aviso de outro assunto: verificacao nula", async () => {
    mockPrisma.notification.findUnique = async () => ({ id: "n2", userId: "u-dono", type: "SERVICO_ACEITO", createdAt: new Date(), readAt: new Date() });
    const GET = await getGET();
    const res = await GET(get("n2", makeAuthHeaders("u-dono", "EMPREGADOR")), ctx("n2"));
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.verificacao, null);
    assert.equal(body.notificacao.lida, true);
  });
});
