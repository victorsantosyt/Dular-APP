import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { makeAuthHeaders, jsonRequest } from "./_helpers";

/**
 * O token de push é do APARELHO. Troca de conta no mesmo aparelho não pode
 * deixar a conta anterior recebendo os avisos, e o logout de um aparelho não
 * pode apagar o token de outro aparelho da mesma pessoa.
 */
async function rota() {
  return import("../../src/app/api/me/push-token/route");
}

const TOKEN = "ExponentPushToken[aparelho-A]";
const OUTRO_TOKEN = "ExponentPushToken[aparelho-B]";

function req(method: "POST" | "DELETE", body: unknown, userId?: string) {
  const base = jsonRequest("http://test/api/me/push-token", body, userId ? makeAuthHeaders(userId, "DIARISTA") : {});
  return new Request(base, { method });
}

/** Banco de mentira: userId → pushToken. */
let banco: Map<string, string | null>;

beforeEach(() => {
  resetMockPrisma();
  banco = new Map([
    ["u-victor", null],
    ["u-josafa", null],
  ]);
  mockPrisma.$transaction = async (ops: unknown) => Promise.all(ops as Promise<unknown>[]);
  mockPrisma.user.update = async (args: any) => {
    banco.set(args.where.id, args.data.pushToken);
    return { id: args.where.id };
  };
  mockPrisma.user.updateMany = async (args: any) => {
    let count = 0;
    for (const [id, token] of banco) {
      const w = args.where;
      const idOk = w.id === undefined ? true : typeof w.id === "string" ? w.id === id : w.id.not !== id;
      if (idOk && token === w.pushToken) {
        banco.set(id, args.data.pushToken);
        count++;
      }
    }
    return { count };
  };
});

describe("POST /api/me/push-token — associação", () => {
  it("sem sessão: 401 e nada muda", async () => {
    const { POST } = await rota();
    const res = await POST(req("POST", { pushToken: TOKEN }));
    assert.equal(res.status, 401);
    assert.equal(banco.get("u-victor"), null);
  });

  it("token com formato inválido: 400", async () => {
    const { POST } = await rota();
    const res = await POST(req("POST", { pushToken: "qualquer" }, "u-victor"));
    assert.equal(res.status, 400);
  });

  it("troca de conta no mesmo aparelho tira o token da conta anterior", async () => {
    const { POST } = await rota();
    assert.equal((await POST(req("POST", { pushToken: TOKEN }, "u-victor"))).status, 200);
    assert.equal(banco.get("u-victor"), TOKEN);

    assert.equal((await POST(req("POST", { pushToken: TOKEN }, "u-josafa"))).status, 200);
    assert.equal(banco.get("u-josafa"), TOKEN);
    assert.equal(banco.get("u-victor"), null, "a conta anterior não pode continuar com o aparelho");
  });

  it("não mexe em conta que tem token de OUTRO aparelho", async () => {
    banco.set("u-victor", OUTRO_TOKEN);
    const { POST } = await rota();
    await POST(req("POST", { pushToken: TOKEN }, "u-josafa"));
    assert.equal(banco.get("u-victor"), OUTRO_TOKEN);
  });
});

describe("DELETE /api/me/push-token — logout", () => {
  it("sem sessão: 401", async () => {
    const { DELETE } = await rota();
    const res = await DELETE(req("DELETE", { pushToken: TOKEN }));
    assert.equal(res.status, 401);
  });

  it("desassocia o token deste aparelho da própria conta", async () => {
    banco.set("u-victor", TOKEN);
    const { DELETE } = await rota();
    const res = await DELETE(req("DELETE", { pushToken: TOKEN }, "u-victor"));
    assert.equal(res.status, 200);
    assert.equal((await res.json()).removido, true);
    assert.equal(banco.get("u-victor"), null);
  });

  it("não apaga o token de outro aparelho da mesma pessoa", async () => {
    banco.set("u-victor", OUTRO_TOKEN);
    const { DELETE } = await rota();
    const res = await DELETE(req("DELETE", { pushToken: TOKEN }, "u-victor"));
    assert.equal(res.status, 200);
    assert.equal((await res.json()).removido, false);
    assert.equal(banco.get("u-victor"), OUTRO_TOKEN);
  });

  it("não apaga o token de outra conta", async () => {
    banco.set("u-josafa", TOKEN);
    const { DELETE } = await rota();
    await DELETE(req("DELETE", { pushToken: TOKEN }, "u-victor"));
    assert.equal(banco.get("u-josafa"), TOKEN);
  });

  it("token inválido: 400", async () => {
    const { DELETE } = await rota();
    const res = await DELETE(req("DELETE", { pushToken: "x" }, "u-victor"));
    assert.equal(res.status, 400);
  });
});

describe("POST e DELETE concorrentes", () => {
  it("DELETE antigo (logout de A) chegando DEPOIS do POST de B não tira o token de B", async () => {
    banco.set("u-victor", TOKEN);
    const { POST, DELETE } = await rota();
    // B entra no mesmo aparelho; o DELETE do logout de A estava atrasado.
    assert.equal((await POST(req("POST", { pushToken: TOKEN }, "u-josafa"))).status, 200);
    await DELETE(req("DELETE", { pushToken: TOKEN }, "u-victor"));
    assert.equal(banco.get("u-josafa"), TOKEN);
    assert.equal(banco.get("u-victor"), null);
  });

  it("ordem normal (DELETE de A antes do POST de B) chega ao mesmo estado", async () => {
    banco.set("u-victor", TOKEN);
    const { POST, DELETE } = await rota();
    await DELETE(req("DELETE", { pushToken: TOKEN }, "u-victor"));
    await POST(req("POST", { pushToken: TOKEN }, "u-josafa"));
    assert.equal(banco.get("u-josafa"), TOKEN);
    assert.equal(banco.get("u-victor"), null);
  });

  it("POST atrasado de A depois do de B devolve o token para A — por isso o app registra de novo", async () => {
    // Limite do servidor: sem saber a ordem das sessões, vale o último POST.
    // O app cobre com o registro por sessão (lib/registroPush: se a conta
    // mudou durante o POST, registra de novo para a conta atual).
    const { POST } = await rota();
    await POST(req("POST", { pushToken: TOKEN }, "u-josafa"));
    await POST(req("POST", { pushToken: TOKEN }, "u-victor"));
    assert.equal(banco.get("u-victor"), TOKEN);
    await POST(req("POST", { pushToken: TOKEN }, "u-josafa"));
    assert.equal(banco.get("u-josafa"), TOKEN);
    assert.equal(banco.get("u-victor"), null);
  });
});
