import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { makeAuthHeaders, jsonRequest } from "./_helpers";

async function getListGET() {
  const mod = await import("../../src/app/api/notificacoes/route");
  return mod.GET;
}
async function getLerPATCH() {
  const mod = await import("../../src/app/api/notificacoes/[id]/ler/route");
  return mod.PATCH;
}
async function getLerTodasPATCH() {
  const mod = await import("../../src/app/api/notificacoes/ler-todas/route");
  return mod.PATCH;
}
async function getPushPOST() {
  const mod = await import("../../src/app/api/me/push-token/route");
  return mod.POST;
}

const DONO = "u-dono";
const OUTRO = "u-outro";

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/notificacoes", () => {
  beforeEach(() => resetMockPrisma());

  it("retorna 401 sem token", async () => {
    const GET = await getListGET();
    const res = await GET(jsonRequest("http://test/api/notificacoes", null));
    assert.equal(res.status, 401);
  });

  it("lista apenas as notificações do usuário autenticado", async () => {
    let whereUsado: any = null;
    mockPrisma.notification.findMany = async (args: any) => {
      whereUsado = args.where;
      return [{ id: "n1", type: "SISTEMA", title: "Oi", body: "x", servicoId: null, chatRoomId: null, readAt: null, createdAt: new Date() }];
    };
    mockPrisma.notification.count = async () => 1;

    const GET = await getListGET();
    const res = await GET(jsonRequest("http://test/api/notificacoes", null, makeAuthHeaders(DONO, "EMPREGADOR")));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    // contrato: chave `notifications`
    assert.ok(Array.isArray(body.notifications));
    // IDOR: query travada no userId do token
    assert.equal(whereUsado?.userId, DONO);
  });
});

describe("PATCH /api/notificacoes/[id]/ler", () => {
  beforeEach(() => resetMockPrisma());

  it("retorna 401 sem token", async () => {
    const PATCH = await getLerPATCH();
    const res = await PATCH(jsonRequest("http://test/api/notificacoes/n1/ler", null), ctx("n1"));
    assert.equal(res.status, 401);
  });

  it("retorna 404 quando notificação não existe", async () => {
    mockPrisma.notification.findUnique = async () => null;
    const PATCH = await getLerPATCH();
    const res = await PATCH(
      jsonRequest("http://test/api/notificacoes/n1/ler", null, makeAuthHeaders(DONO, "EMPREGADOR")),
      ctx("n1"),
    );
    assert.equal(res.status, 404);
  });

  it("retorna 403 ao marcar notificação de outro usuário (IDOR)", async () => {
    mockPrisma.notification.findUnique = async () => ({ id: "n1", userId: OUTRO, readAt: null });
    let updateCalled = false;
    mockPrisma.notification.update = async () => {
      updateCalled = true;
      return {};
    };
    const PATCH = await getLerPATCH();
    const res = await PATCH(
      jsonRequest("http://test/api/notificacoes/n1/ler", null, makeAuthHeaders(DONO, "EMPREGADOR")),
      ctx("n1"),
    );
    assert.equal(res.status, 403);
    assert.equal(updateCalled, false);
  });

  it("dono marca a própria notificação como lida (200)", async () => {
    mockPrisma.notification.findUnique = async () => ({ id: "n1", userId: DONO, readAt: null });
    mockPrisma.notification.update = async () => ({ id: "n1" });
    const PATCH = await getLerPATCH();
    const res = await PATCH(
      jsonRequest("http://test/api/notificacoes/n1/ler", null, makeAuthHeaders(DONO, "EMPREGADOR")),
      ctx("n1"),
    );
    assert.equal(res.status, 200);
  });
});

describe("PATCH /api/notificacoes/ler-todas", () => {
  beforeEach(() => resetMockPrisma());

  it("retorna 401 sem token", async () => {
    const PATCH = await getLerTodasPATCH();
    const res = await PATCH(jsonRequest("http://test/api/notificacoes/ler-todas", null));
    assert.equal(res.status, 401);
  });

  it("marca como lidas apenas as notificações do próprio usuário", async () => {
    let whereUsado: any = null;
    mockPrisma.notification.updateMany = async (args: any) => {
      whereUsado = args.where;
      return { count: 3 };
    };
    const PATCH = await getLerTodasPATCH();
    const res = await PATCH(
      jsonRequest("http://test/api/notificacoes/ler-todas", null, makeAuthHeaders(DONO, "EMPREGADOR")),
    );
    assert.equal(res.status, 200);
    assert.equal(whereUsado?.userId, DONO);
  });
});

describe("POST /api/me/push-token", () => {
  beforeEach(() => resetMockPrisma());

  it("retorna 401 sem token", async () => {
    const POST = await getPushPOST();
    const res = await POST(jsonRequest("http://test/api/me/push-token", { pushToken: "ExponentPushToken[abc]" }));
    assert.equal(res.status, 401);
  });

  it("retorna 400 para formato de token inválido", async () => {
    const POST = await getPushPOST();
    const res = await POST(
      jsonRequest("http://test/api/me/push-token", { pushToken: "token-invalido" }, makeAuthHeaders(DONO, "EMPREGADOR")),
    );
    assert.equal(res.status, 400);
  });

  it("salva o token apenas no próprio usuário", async () => {
    let whereUsado: any = null;
    mockPrisma.user.update = async (args: any) => {
      whereUsado = args.where;
      return { id: DONO };
    };
    const POST = await getPushPOST();
    const res = await POST(
      jsonRequest(
        "http://test/api/me/push-token",
        { pushToken: "ExponentPushToken[abc123]" },
        makeAuthHeaders(DONO, "EMPREGADOR"),
      ),
    );
    assert.equal(res.status, 200);
    assert.equal(whereUsado?.id, DONO);
  });
});
