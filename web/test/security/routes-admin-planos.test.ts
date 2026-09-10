import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { resetMockPrisma } from "./_mocks";
import { makeAuthHeaders } from "./_helpers";
import { limiteAnunciado } from "../../src/lib/adminPlanos";

async function getGet() {
  const mod = await import("../../src/app/api/admin/planos/route");
  return mod.GET;
}

function getRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://test/api/admin/planos", { method: "GET", headers });
}

describe("GET /api/admin/planos", () => {
  beforeEach(() => {
    resetMockPrisma();
  });

  it("retorna 401 sem token", async () => {
    const GET = await getGet();
    const res = await GET(getRequest());
    assert.equal(res.status, 401);
  });

  // A rota expõe o desenho do paywall e a lista de quem paga. Quem não é ADMIN
  // não passa, qualquer que seja o papel — inclusive os que têm assinatura e
  // portanto teriam motivo para querer ler isso.
  for (const role of ["EMPREGADOR", "DIARISTA", "MONTADOR"] as const) {
    it(`retorna 403 quando o token é de ${role}`, async () => {
      const GET = await getGet();
      const res = await GET(getRequest(makeAuthHeaders(`u-${role}`, role)));
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.ok, false);
    });
  }

  it("não expõe nenhum verbo de escrita", async () => {
    const mod = await import("../../src/app/api/admin/planos/route");
    // Editar limite por requisição seria desligar o paywall com um POST.
    // Mudança de limite é migration, com revisão e histórico.
    for (const verbo of ["POST", "PUT", "PATCH", "DELETE"]) {
      assert.equal(
        (mod as Record<string, unknown>)[verbo],
        undefined,
        `a rota não pode exportar ${verbo}`
      );
    }
  });
});

describe("limiteAnunciado — leitura da descrição do catálogo", () => {
  it("lê 'Até N serviços' como N", () => {
    assert.deepEqual(limiteAnunciado("Até 10 serviços por mês"), {
      valor: 10,
      legivel: true,
    });
  });

  it("lê 'ilimitado' como sem limite", () => {
    assert.deepEqual(limiteAnunciado("Serviços ilimitados por mês"), {
      valor: null,
      legivel: true,
    });
    assert.deepEqual(limiteAnunciado("Serviços ilimitados por 1 ano"), {
      valor: null,
      legivel: true,
    });
  });

  // O ponto do diagnóstico é não afirmar o que não dá para saber: uma redação
  // nova no catálogo tem que aparecer como ilegível, e não como "bate".
  it("marca como ilegível a descrição que não declara limite", () => {
    assert.deepEqual(limiteAnunciado("Plano com vantagens exclusivas"), {
      valor: null,
      legivel: false,
    });
  });

  it("não confunde 'ilimitado' com um número solto na frase", () => {
    assert.deepEqual(limiteAnunciado("Serviços ilimitados por 1 ano"), {
      valor: null,
      legivel: true,
    });
  });
});
