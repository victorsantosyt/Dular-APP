import assert from "node:assert/strict";
import test from "node:test";
import {
  estadoDeVisibilidadeDiarista,
  podeAfirmarVisibilidade,
} from "../src/lib/diaristaVisibilidade";

/**
 * Trava a mentira que a auditoria mediu: com os cinco blocos preenchidos, a
 * tela afirmava "Seu perfil está completo e aparece na busca" mesmo com o
 * perfil inativo ou a conta bloqueada — casos em que o backend já exclui o
 * perfil da busca.
 */

const base = { dadosCompletos: true, profileAtivo: true, userStatus: "ATIVO" };

test("A) dados completos, perfil ativo e conta ATIVA é elegível", () => {
  assert.equal(estadoDeVisibilidadeDiarista(base), "ELEGIVEL");
  assert.equal(podeAfirmarVisibilidade(estadoDeVisibilidadeDiarista(base)), true);
});

test("B) perfil inativo não aparece na busca, mesmo com dados 100%", () => {
  const e = estadoDeVisibilidadeDiarista({ ...base, profileAtivo: false });
  assert.equal(e, "PERFIL_INATIVO");
  assert.equal(podeAfirmarVisibilidade(e), false);
});

test("C) conta bloqueada não aparece na busca, mesmo com dados 100%", () => {
  const e = estadoDeVisibilidadeDiarista({ ...base, userStatus: "BLOQUEADO" });
  assert.equal(e, "CONTA_BLOQUEADA");
  assert.equal(podeAfirmarVisibilidade(e), false);
});

test("D) dados incompletos com conta em ordem é incompletude, não bloqueio", () => {
  const e = estadoDeVisibilidadeDiarista({ ...base, dadosCompletos: false });
  assert.equal(e, "DADOS_INCOMPLETOS");
  assert.equal(podeAfirmarVisibilidade(e), false);
});

test("E) status ausente ou desconhecido nunca afirma visibilidade", () => {
  // Mesma escolha do backend: `!== "ATIVO"` em vez de `=== "BLOQUEADO"`.
  // Nulo, ausente ou valor futuro recusam — falha fechado.
  for (const status of [null, undefined, "", "PENDENTE_DE_ALGO"]) {
    const e = estadoDeVisibilidadeDiarista({ ...base, userStatus: status });
    assert.equal(e, "STATUS_INDETERMINADO", `status ${String(status)}`);
    assert.equal(podeAfirmarVisibilidade(e), false);
  }
});

test("conta removida tem estado próprio", () => {
  assert.equal(
    estadoDeVisibilidadeDiarista({ ...base, userStatus: "REMOVIDO" }),
    "CONTA_REMOVIDA",
  );
});

test("F/G) bloqueio de conta ou perfil não é tratado como dado faltando", () => {
  // O percentual continua vindo da completude dos dados. Se um bloqueio
  // virasse "dado faltando", a pessoa sairia procurando um campo vazio que
  // não existe — e a barra cairia de 100% para 80% sem nada ter mudado no
  // cadastro. Por isso os estados são distintos de DADOS_INCOMPLETOS.
  assert.notEqual(
    estadoDeVisibilidadeDiarista({ ...base, profileAtivo: false }),
    "DADOS_INCOMPLETOS",
  );
  assert.notEqual(
    estadoDeVisibilidadeDiarista({ ...base, userStatus: "BLOQUEADO" }),
    "DADOS_INCOMPLETOS",
  );
});

test("bloqueio de conta tem precedência sobre dados incompletos", () => {
  // Quem está bloqueada não resolve nada preenchendo campo.
  assert.equal(
    estadoDeVisibilidadeDiarista({
      dadosCompletos: false,
      profileAtivo: false,
      userStatus: "BLOQUEADO",
    }),
    "CONTA_BLOQUEADA",
  );
});
