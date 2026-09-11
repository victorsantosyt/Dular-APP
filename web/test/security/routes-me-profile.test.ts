import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { makeAuthHeaders, jsonRequest } from "./_helpers";

async function getHandler() {
  const mod = await import("../../src/app/api/me/route");
  return mod.PUT;
}

const EMPREGADOR_ID = "u-empregador-1";

describe("PUT /api/me — perfil (telefone)", () => {
  beforeEach(() => {
    resetMockPrisma();
    // A rota passou a exigir conta ATIVA (requireAuthAtivo): antes, uma conta
    // REMOVIDO reescrevia nome e e-mail aqui e desfazia a anonimização.
    // O padrão dos casos abaixo é conta ativa; o caso de conta inativa é o
    // último deste describe.
    mockPrisma.user.findUnique = async () => ({ status: "ATIVO" });
  });

  it("retorna 401 sem token", async () => {
    const PUT = await getHandler();
    const res = await PUT(jsonRequest("http://test/api/me", { telefone: "11999999999" }));
    assert.equal(res.status, 401);
  });

  it("persiste telefone do próprio usuário autenticado (sem IDOR)", async () => {
    let updateArgs: any = null;
    mockPrisma.user.update = async (args: any) => {
      updateArgs = args;
      return {
        id: EMPREGADOR_ID,
        nome: "Empregador Teste",
        telefone: "11988887777",
        email: null,
        genero: null,
        role: "EMPREGADOR",
        status: "ATIVO",
        avatarUrl: null,
      };
    };

    const PUT = await getHandler();
    const res = await PUT(
      jsonRequest(
        "http://test/api/me",
        { nome: "Empregador Teste", telefone: "11988887777" },
        makeAuthHeaders(EMPREGADOR_ID, "EMPREGADOR"),
      ),
    );

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.user.telefone, "11988887777");
    // telefone deve chegar no data do update
    assert.equal(updateArgs?.data?.telefone, "11988887777");
    // IDOR: update sempre travado no id do token
    assert.equal(updateArgs?.where?.id, EMPREGADOR_ID);
  });

  it("normaliza telefone vazio para null", async () => {
    let updateArgs: any = null;
    mockPrisma.user.update = async (args: any) => {
      updateArgs = args;
      return {
        id: EMPREGADOR_ID,
        nome: "Empregador Teste",
        telefone: null,
        email: null,
        genero: null,
        role: "EMPREGADOR",
        status: "ATIVO",
        avatarUrl: null,
      };
    };

    const PUT = await getHandler();
    const res = await PUT(
      jsonRequest(
        "http://test/api/me",
        { telefone: "   " },
        makeAuthHeaders(EMPREGADOR_ID, "EMPREGADOR"),
      ),
    );

    assert.equal(res.status, 200);
    assert.equal(updateArgs?.data?.telefone, null);
  });

  it("retorna 409 quando telefone já está em uso (P2002)", async () => {
    mockPrisma.user.update = async () => {
      throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["telefone"] },
      });
    };

    const PUT = await getHandler();
    const res = await PUT(
      jsonRequest(
        "http://test/api/me",
        { telefone: "11900000000" },
        makeAuthHeaders(EMPREGADOR_ID, "EMPREGADOR"),
      ),
    );

    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.match(body.error, /telefone/i);
  });
  // Conta bloqueada e conta excluída não escrevem por aqui. Sem isto, o token
  // de 7 dias emitido antes do bloqueio continuava valendo.
  for (const [status, codigo] of [
    ["BLOQUEADO", "CONTA_BLOQUEADA"],
    ["REMOVIDO", "CONTA_REMOVIDA"],
  ] as const) {
    it(`recusa com 403 ${codigo} quando a conta está ${status}`, async () => {
      mockPrisma.user.findUnique = async () => ({ status });
      mockPrisma.user.update = async () => {
        throw new Error("não devia chegar ao update");
      };
      const PUT = await getHandler();
      const res = await PUT(
        jsonRequest(
          "http://test/api/me",
          { telefone: "11999999999" },
          makeAuthHeaders(EMPREGADOR_ID, "EMPREGADOR"),
        ),
      );
      assert.equal(res.status, 403);
      assert.equal((await res.json()).error, codigo);
    });
  }
});
