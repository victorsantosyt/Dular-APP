import assert from "node:assert/strict";
import test from "node:test";
import { estadoDaCompletude, deveMostrarProgresso } from "../src/lib/profileProgress";

const mostra = (p: Parameters<typeof estadoDaCompletude>[0]) =>
  deveMostrarProgresso(estadoDaCompletude(p));

test("A) dados ainda carregando não renderizam progresso", () => {
  // É aqui que nascia o piscar: com o perfil nulo, os três perfis caíam em
  // `?? 0` e a tela abria mostrando "0%".
  assert.equal(estadoDaCompletude({ carregado: false, progresso: null }), "UNKNOWN");
  assert.equal(mostra({ carregado: false, progresso: null }), false);
  assert.equal(mostra({ carregado: false, progresso: 0 }), false);
  assert.equal(mostra({ carregado: false, progresso: 100 }), false);
});

test("B) perfil em 60% renderiza", () => {
  assert.equal(estadoDaCompletude({ carregado: true, progresso: 60 }), "INCOMPLETE");
  assert.equal(mostra({ carregado: true, progresso: 60 }), true);
});

test("C) perfil em 99% ainda renderiza", () => {
  assert.equal(mostra({ carregado: true, progresso: 99 }), true);
});

test("D) perfil em 100% não renderiza", () => {
  assert.equal(estadoDaCompletude({ carregado: true, progresso: 100 }), "COMPLETE");
  assert.equal(mostra({ carregado: true, progresso: 100 }), false);
  // Acima de 100 também: arredondamento não pode ressuscitar a barra.
  assert.equal(mostra({ carregado: true, progresso: 101 }), false);
});

test("E) 100% com documento pendente continua sem progresso", () => {
  // A pendência documental é outro card. Se ela mantivesse a barra viva, o
  // perfil exibiria "100%" para sempre ao lado de um aviso que não fala de
  // preenchimento — que é o defeito atual de Empregador e Diarista.
  assert.equal(mostra({ carregado: true, progresso: 100, completo: true }), false);
});

test("F/G) reabrir ou relogar com perfil completo não traz a barra de volta", () => {
  // Reopen e relogin passam por UNKNOWN antes de ter dados. Nenhum dos dois
  // pode piscar a barra no caminho.
  assert.equal(mostra({ carregado: false, progresso: null }), false);
  assert.equal(mostra({ carregado: true, progresso: 100 }), false);
});

test("H) perfil que volta a ficar incompleto mostra a barra de novo", () => {
  assert.equal(mostra({ carregado: true, progresso: 80, completo: false }), true);
});

test("`completo` da fonte canônica vence o percentual", () => {
  // O backend do montador devolve `completude.completo` ao lado do progresso.
  // Se ele afirma completo, um percentual arredondado para 99 não reabre a barra.
  assert.equal(mostra({ carregado: true, progresso: 99, completo: true }), false);
});

test("progresso ausente com dados carregados não inventa percentual", () => {
  assert.equal(estadoDaCompletude({ carregado: true, progresso: null }), "UNKNOWN");
  assert.equal(mostra({ carregado: true, progresso: undefined }), false);
});
