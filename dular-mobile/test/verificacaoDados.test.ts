import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { nomeCompletoValido } from "../src/utils/formatters";

const tela = readFileSync(join(import.meta.dirname, "..", "src", "screens", "perfil", "VerificacaoDocs.tsx"), "utf8");

test("nome completo: mesma regra do servidor", () => {
  assert.equal(nomeCompletoValido("Maria"), false, "só um nome");
  assert.equal(nomeCompletoValido("Maria 123"), false, "com números");
  assert.equal(nomeCompletoValido("  Maria   da  Silva "), true);
  assert.equal(nomeCompletoValido("José D'Ávila"), true);
  assert.equal(nomeCompletoValido("A B"), false, "partes curtas");
});

test("verificação: pede só o nome completo que falta e grava antes dos arquivos", () => {
  assert.match(tela, /const faltaNomeCompleto = !currentUser\?\.nomeCompleto;/);
  const envio = tela.slice(tela.indexOf("const enviar = async"));
  assert.ok(envio.indexOf("atualizarDadosPessoais({ nomeCompleto") < envio.indexOf('api.post("/api/verificacoes"'), "nome antes do upload");
});

test("verificação: motivo da reprovação ou do reenvio aparece na tela", () => {
  assert.match(tela, /setMotivo\(me\.motivoVerificacao \?\? null\)/);
  assert.match(tela, /Motivo: \{motivo\}/);
  assert.match(tela, /Precisamos de um novo envio/);
});
