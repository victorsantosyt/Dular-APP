import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { makeAuthHeaders } from "./_helpers";
import {
  assertContaAtiva,
  requireAuthAtivo,
  respostaDeSessao,
  ContaInativaError,
} from "../../src/lib/contaAtiva";

function req(headers: Record<string, string> = {}): Request {
  return new Request("http://test/api/qualquer", { method: "GET", headers });
}

/** Faz o banco responder com um status arbitrário para qualquer usuário. */
function bancoDiz(status: unknown) {
  mockPrisma.user.findUnique = async () => (status === "SEM_USUARIO" ? null : { status });
}

describe("assertContaAtiva — falha fechado", () => {
  beforeEach(() => {
    resetMockPrisma();
  });

  // CONTROLE POSITIVO: sem ele, "tudo recusa" passaria como se fosse acerto.
  it("ATIVO passa", async () => {
    bancoDiz("ATIVO");
    await assertContaAtiva("u1");
  });

  for (const [status, esperado] of [
    ["BLOQUEADO", "BLOQUEADO"],
    ["REMOVIDO", "REMOVIDO"],
  ] as const) {
    it(`${status} recusa e é classificado como ${esperado}`, async () => {
      bancoDiz(status);
      await assert.rejects(
        () => assertContaAtiva("u1"),
        (e: unknown) =>
          e instanceof ContaInativaError && e.statusDaConta === esperado
      );
    });
  }

  // O ponto da regra: nada além da igualdade literal com "ATIVO" libera.
  // `status && status !== "ATIVO"` deixaria os três primeiros passarem — é a
  // armadilha que está em diaristaProfile.ts.
  for (const [rotulo, valor] of [
    ["null", null],
    ["undefined", undefined],
    ["string vazia", ""],
    ["usuário inexistente", "SEM_USUARIO"],
    ["valor futuro desconhecido", "SUSPENSO_TEMPORARIO"],
    ["minúsculo", "ativo"],
    ["com espaço", " ATIVO"],
  ] as const) {
    it(`recusa quando o status é ${rotulo}`, async () => {
      bancoDiz(valor);
      await assert.rejects(
        () => assertContaAtiva("u1"),
        (e: unknown) => e instanceof ContaInativaError
      );
    });
  }
});

describe("requireAuthAtivo", () => {
  beforeEach(() => {
    resetMockPrisma();
  });

  it("sem token lança Unauthorized antes de tocar o banco", async () => {
    mockPrisma.user.findUnique = async () => {
      throw new Error("o banco não devia ser consultado sem token");
    };
    await assert.rejects(() => requireAuthAtivo(req()), /Unauthorized/);
  });

  // CONTROLE POSITIVO
  it("token válido de conta ATIVA devolve o payload", async () => {
    bancoDiz("ATIVO");
    const auth = await requireAuthAtivo(req(makeAuthHeaders("u1", "EMPREGADOR")));
    assert.equal(auth.userId, "u1");
    assert.equal(auth.role, "EMPREGADOR");
  });

  it("token válido de conta BLOQUEADA é recusado", async () => {
    bancoDiz("BLOQUEADO");
    await assert.rejects(
      () => requireAuthAtivo(req(makeAuthHeaders("u1", "EMPREGADOR"))),
      (e: unknown) => e instanceof ContaInativaError
    );
  });

  // O token continua criptograficamente válido por 7 dias depois da exclusão:
  // limpar o cookie e apagar o token no app não invalida o que já foi emitido.
  // Sem consulta ao banco, a conta anonimizada seguia entrando.
  it("token emitido antes da exclusão não vale mais", async () => {
    bancoDiz("REMOVIDO");
    await assert.rejects(
      () => requireAuthAtivo(req(makeAuthHeaders("u1", "EMPREGADOR"))),
      (e: unknown) =>
        e instanceof ContaInativaError && e.statusDaConta === "REMOVIDO"
    );
  });
});

describe("respostaDeSessao — distingue os estados sem vazar", () => {
  it("credencial inválida é 401", () => {
    const r = respostaDeSessao(new Error("Unauthorized"));
    assert.equal(r?.status, 401);
  });

  it("conta bloqueada é 403 com código próprio", async () => {
    const r = respostaDeSessao(new ContaInativaError("BLOQUEADO"));
    assert.equal(r?.status, 403);
    assert.equal((await r!.json()).error, "CONTA_BLOQUEADA");
  });

  it("conta removida é 403 com código próprio", async () => {
    const r = respostaDeSessao(new ContaInativaError("REMOVIDO"));
    assert.equal(r?.status, 403);
    assert.equal((await r!.json()).error, "CONTA_REMOVIDA");
  });

  // Status que ninguém previu não deve descrever a conta — só recusar.
  it("estado desconhecido é 403 genérico", async () => {
    const r = respostaDeSessao(new ContaInativaError("DESCONHECIDO"));
    assert.equal(r?.status, 403);
    assert.equal((await r!.json()).error, "CONTA_INATIVA");
  });

  // CONTROLE POSITIVO do próprio helper: erro que não é de sessão passa adiante
  // em vez de virar 403 e esconder um bug real.
  it("erro que não é de sessão devolve null", () => {
    assert.equal(respostaDeSessao(new Error("P2002")), null);
    assert.equal(respostaDeSessao(new TypeError("qualquer outra coisa")), null);
  });
});
