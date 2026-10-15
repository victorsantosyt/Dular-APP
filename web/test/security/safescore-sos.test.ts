import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { makeAuthHeaders } from "./_helpers";
import { GET } from "../../src/app/api/seguranca/eventos/route";

const req = (auth = true) => new Request("http://test/api/seguranca/eventos?type=SOS_SILENT&limit=50&userId=outro", {
  headers: auth ? makeAuthHeaders("dono", "DIARISTA") : {},
});
const db = mockPrisma as any;
beforeEach(() => { resetMockPrisma(); db.safetyEvent = { findMany: async () => [] }; });

describe("Acompanhamento real de SOS", () => {
  it("recusa ausência de sessão", async () => assert.equal((await GET(req(false))).status, 401));
  it("estado vazio apenas após consulta bem-sucedida", async () => {
    const res = await GET(req());
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json()).eventos, []);
  });
  it("erro de banco não se transforma em histórico vazio", async () => {
    db.safetyEvent.findMany = async () => { throw new Error("offline"); };
    const res = await GET(req());
    assert.equal(res.status, 500);
    assert.equal(Object.hasOwn(await res.json(), "eventos"), false);
  });
  it("consulta somente a sessão e devolve status de atendimento e atualização", async () => {
    let where: unknown;
    db.safetyEvent.findMany = async (args: any) => {
      where = args.where;
      return [null, "ACIONADO", "EM_ATENDIMENTO", "RESOLVIDO"].map((status, i) => ({
        id: `sos-${i}`, type: "SOS_SILENT", status, createdAt: "2026-10-15T12:00:00.000Z",
        statusAtualizadoEm: status === "RESOLVIDO" ? "2026-10-15T13:00:00.000Z" : null,
      }));
    };
    const res = await GET(req());
    assert.equal(res.status, 200);
    assert.deepEqual(where, { userId: "dono", type: "SOS_SILENT" });
    const { eventos } = await res.json();
    assert.deepEqual(eventos.map((e: any) => e.statusLabel), ["Acionado", "Acionado", "Em atendimento", "Resolvido"]);
    assert.equal(eventos[3].statusAtualizadoEm, "2026-10-15T13:00:00.000Z");
  });
});
