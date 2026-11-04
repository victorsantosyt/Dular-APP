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

describe("relacaoDoAviso — a decisão do aviso ainda vale?", () => {
  it("pedido de reenvio antigo, aberto depois da aprovação do novo envio: ENVIO_ANTERIOR", () => {
    const envios = [
      envio("e1", "2026-10-01T10:00:00Z", [["d1", "REENVIO", "2026-10-02T10:00:00.000Z"]]),
      envio("e2", "2026-10-03T10:00:00Z", [["d2", "APROVADO", "2026-10-04T10:00:00.000Z"]]),
    ];
    const r = relacaoDoAviso({ type: "VERIFICACAO_REPROVADA", createdAt: t("2026-10-02T10:00:00.120Z") }, envios);
    assert.deepEqual(r, { relacao: "ENVIO_ANTERIOR", decisaoDoAviso: "REENVIO" });
  });

  it("aprovação revisada depois para reprovação: o aviso de aprovação é SUPERADA, o de reprovação é VIGENTE", () => {
    const envios = [
      envio("e1", "2026-10-01T10:00:00Z", [
        ["d1", "APROVADO", "2026-10-02T10:00:00.000Z"],
        ["d2", "REPROVADO", "2026-10-05T10:00:00.000Z"],
      ]),
    ];
    assert.equal(relacaoDoAviso({ type: "VERIFICACAO_APROVADA", createdAt: t("2026-10-02T10:00:00.050Z") }, envios).relacao, "SUPERADA");
    assert.equal(relacaoDoAviso({ type: "VERIFICACAO_REPROVADA", createdAt: t("2026-10-05T10:00:00.050Z") }, envios).relacao, "VIGENTE");
  });

  it("decisão atual: VIGENTE", () => {
    const envios = [envio("e1", "2026-10-01T10:00:00Z", [["d1", "APROVADO", "2026-10-02T10:00:00.000Z"]])];
    assert.deepEqual(relacaoDoAviso({ type: "VERIFICACAO_APROVADA", createdAt: t("2026-10-02T10:00:01Z") }, envios), {
      relacao: "VIGENTE",
      decisaoDoAviso: "APROVADO",
    });
  });

  it("tipo não bate com a decisão do mesmo instante: não liga (aviso de aprovação não vira a reprovação)", () => {
    const envios = [envio("e1", "2026-10-01T10:00:00Z", [["d1", "REPROVADO", "2026-10-02T10:00:00.000Z"]])];
    assert.equal(relacaoDoAviso({ type: "VERIFICACAO_APROVADA", createdAt: t("2026-10-02T10:00:00.100Z") }, envios).relacao, "INDETERMINADA");
  });

  it("aviso sem decisão no histórico, anterior ao envio atual: ENVIO_ANTERIOR (pelo tempo)", () => {
    const envios = [envio("e2", "2026-10-03T10:00:00Z", [])];
    assert.equal(relacaoDoAviso({ type: "VERIFICACAO_REPROVADA", createdAt: t("2026-10-01T09:00:00Z") }, envios).relacao, "ENVIO_ANTERIOR");
  });

  it("sem envios ou tipo de outro assunto: INDETERMINADA", () => {
    assert.equal(relacaoDoAviso({ type: "VERIFICACAO_APROVADA", createdAt: t("2026-10-01T09:00:00Z") }, []).relacao, "INDETERMINADA");
    assert.equal(relacaoDoAviso({ type: "SERVICO_ACEITO", createdAt: t("2026-10-01T09:00:00Z") }, [envio("e1", "2026-10-01T08:00:00Z", [])]).relacao, "INDETERMINADA");
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
    assert.deepEqual(body.verificacao, { relacao: "ENVIO_ANTERIOR", decisaoDoAviso: "REENVIO" });
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
