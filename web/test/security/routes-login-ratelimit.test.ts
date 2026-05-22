import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";

async function getPost() {
  const mod = await import("../../src/app/api/auth/login/route");
  return mod.POST;
}

function loginRequest(login: string, senha: string, ip: string) {
  return new Request("http://test/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify({ login, senha }),
  });
}

describe("POST /api/auth/login — rate limit", () => {
  beforeEach(() => {
    resetMockPrisma();
    // Credenciais inválidas: o objetivo é exercitar rate limit, não login OK.
    mockPrisma.user.findFirst = async () => null;
  });

  it("retorna 429 após exceder limite por usuário (8 tentativas)", async () => {
    const POST = await getPost();
    // Usuário único para isolar o bucket per-user (limite 8/min).
    // Cada chamada usa um IP diferente para não disparar o bucket por-IP (20/min).
    const login = `phone-burst-${Date.now()}@x`;

    let last;
    for (let i = 0; i < 10; i++) {
      const ip = `203.0.113.${i + 1}`;
      last = await POST(loginRequest(login, "wrong-password", ip));
    }

    assert.equal(last!.status, 429);
    const body = await last!.json();
    // Resposta via fail(): { ok: false, error: { code, message, retryAfterMs } }
    assert.equal(body.error.code, "rate_limited");
    assert.ok(typeof body.error.retryAfterMs === "number");
    assert.ok(body.error.retryAfterMs >= 0);
  });

  it("retorna 429 após exceder limite por IP (20 tentativas)", async () => {
    const POST = await getPost();
    const ip = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;

    let last;
    for (let i = 0; i < 25; i++) {
      // Logins diferentes para evitar o bucket per-user.
      const login = `phone-${i}-${Math.random()}@x`;
      last = await POST(loginRequest(login, "wrong-password", ip));
    }

    assert.equal(last!.status, 429);
  });

  it("retryAfterMs nunca é negativo nem NaN", async () => {
    const POST = await getPost();
    const login = `single-${Date.now()}@x`;

    let blocked: Response | undefined;
    for (let i = 0; i < 15; i++) {
      const ip = `192.0.2.${i + 1}`;
      // senha precisa ter min 6 (passar pelo zod) para chegar no rate limit
      const res = await POST(loginRequest(login, "senha-errada", ip));
      if (res.status === 429) {
        blocked = res;
        break;
      }
    }

    assert.ok(blocked, "esperava receber 429");
    const body = await blocked!.json();
    assert.ok(body.error.retryAfterMs >= 0);
    assert.ok(!Number.isNaN(body.error.retryAfterMs));
  });
});
