import assert from "node:assert/strict";
import test from "node:test";
import { classifyBootstrapFailure, getAuthenticatedGate } from "../src/stores/authBootstrap";

const completeUser = {
  genero: "FEMININO",
  cpf: "12345678901",
  dataNascimento: "1990-01-01",
};

test("usuário canônico completo ignora snapshot parcial e segue para Home", () => {
  const partialCachedUser = { genero: "FEMININO", cpf: null, dataNascimento: null };

  assert.equal(getAuthenticatedGate("EMPREGADOR", completeUser), "home");
  assert.equal(getAuthenticatedGate("EMPREGADOR", partialCachedUser), "dados-pessoais");
});

test("usuário canônico realmente incompleto recebe o gate de dados pessoais", () => {
  assert.equal(
    getAuthenticatedGate("EMPREGADOR", { ...completeUser, cpf: null }),
    "dados-pessoais",
  );
});

test("401 e 403 invalidam a sessão; falhas transitórias mantêm possibilidade de retry", () => {
  assert.equal(classifyBootstrapFailure({ response: { status: 401 } }), "invalid-session");
  assert.equal(classifyBootstrapFailure({ response: { status: 403 } }), "invalid-session");
  assert.equal(classifyBootstrapFailure({ response: { status: 500 } }), "transient");
  assert.equal(classifyBootstrapFailure({ code: "ECONNABORTED" }), "transient");
});

test("diarista canônica com serviços não recebe gate de nichos", () => {
  assert.equal(
    getAuthenticatedGate("DIARISTA", { ...completeUser, servicosOferecidos: ["CUIDADORA"] }),
    "home",
  );
});

test("montador canônico com especialidades não recebe gate falso", () => {
  assert.equal(
    getAuthenticatedGate("MONTADOR", { ...completeUser, especialidades: ["eletrica"] }),
    "home",
  );
});
