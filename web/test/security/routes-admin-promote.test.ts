import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { makeAuthHeaders, jsonRequest } from "./_helpers";

async function getPost() {
  const mod = await import("../../src/app/api/admin/admins/promote/route");
  return mod.POST;
}

describe("POST /api/admin/admins/promote", () => {
  beforeEach(() => {
    resetMockPrisma();
  });

  it("retorna 401 sem token", async () => {
    const POST = await getPost();
    const res = await POST(
      jsonRequest("http://test/api/admin/admins/promote", { telefone: "11999999999" }),
    );
    assert.equal(res.status, 401);
  });

  it("retorna 403 quando o token é de EMPREGADOR", async () => {
    // requireAdmin consulta o banco para confirmar o role atual (defesa
    // contra token antigo). Aqui o banco diz EMPREGADOR.
    mockPrisma.user.findUnique = async () => ({ role: "EMPREGADOR" });
    const POST = await getPost();
    const res = await POST(
      jsonRequest(
        "http://test/api/admin/admins/promote",
        { telefone: "11999999999" },
        makeAuthHeaders("u-empregador", "EMPREGADOR"),
      ),
    );
    assert.equal(res.status, 403);
  });

  it("retorna 403 quando o token é de DIARISTA", async () => {
    mockPrisma.user.findUnique = async () => ({ role: "DIARISTA" });
    const POST = await getPost();
    const res = await POST(
      jsonRequest(
        "http://test/api/admin/admins/promote",
        { telefone: "11999999999" },
        makeAuthHeaders("u-diarista", "DIARISTA"),
      ),
    );
    assert.equal(res.status, 403);
  });

  it("retorna 403 quando o role no JWT diz ADMIN mas o banco diz EMPREGADOR (stale token)", async () => {
    // Cenário crítico: usuário foi rebaixado mas ainda tem token antigo.
    mockPrisma.user.findUnique = async () => ({ role: "EMPREGADOR" });
    const POST = await getPost();
    const res = await POST(
      jsonRequest(
        "http://test/api/admin/admins/promote",
        { telefone: "11999999999" },
        makeAuthHeaders("u-stale-admin", "ADMIN"),
      ),
    );
    assert.equal(res.status, 403);
  });

  it("retorna 400 com body inválido quando o admin é legítimo", async () => {
    mockPrisma.user.findUnique = async () => ({ role: "ADMIN" });
    const POST = await getPost();
    const res = await POST(
      jsonRequest(
        "http://test/api/admin/admins/promote",
        { telefone: "x" }, // falha no zod schema (min 10)
        makeAuthHeaders("u-admin", "ADMIN"),
      ),
    );
    assert.equal(res.status, 400);
  });

  it("retorna 404 quando admin legítimo tenta promover telefone inexistente", async () => {
    // Primeiro lookup: requireAdmin → role ADMIN. Segundo: dentro do
    // transaction, retorna null.
    let call = 0;
    mockPrisma.user.findUnique = async () => {
      call += 1;
      if (call === 1) return { role: "ADMIN" };
      return null;
    };
    mockPrisma.$transaction = (async (cb: any) => cb(mockPrisma)) as any;

    const POST = await getPost();
    const res = await POST(
      jsonRequest(
        "http://test/api/admin/admins/promote",
        { telefone: "11999999999" },
        makeAuthHeaders("u-admin", "ADMIN"),
      ),
    );
    assert.equal(res.status, 404);
  });
});
