import assert from "node:assert/strict";
import test from "node:test";
import { calcularImeInsetAndroid } from "../src/lib/keyboardInset";

/**
 * Conta da oclusão do teclado no Android edge-to-edge.
 *
 * Os números vêm do aparelho (Samsung SM-A315G, 1080x2400 @420dpi), medidos no
 * APK v19 com instrumentação: tela de 914,29dp e topo do teclado em 536,762dp
 * nos dois modos de navegação.
 */

test("três botões: a oclusão é a distância da borda da tela ao topo do teclado", () => {
  const inset = calcularImeInsetAndroid(914.2857142857143, 536.7619018554688);
  assert.ok(Math.abs(inset - 377.528) < 0.01, `esperado ~377.528, veio ${inset}`);
});

test("a conta NÃO é endCoordinates.height", () => {
  // No mesmo evento o Android reportou height=329,52 — 48dp a menos, que é
  // justamente a barra de navegação. Numa árvore que vai até a borda física da
  // tela essa barra também precisa sair do caminho.
  const inset = calcularImeInsetAndroid(914.2857142857143, 536.7619018554688);
  assert.ok(inset > 329.5238037109375);
  assert.ok(Math.abs(inset - 329.5238037109375 - 48) < 0.01);
});

test("gestos: mesmo topo de teclado, mesma oclusão", () => {
  // O topo do IME não muda com o modo de navegação; o que muda é quanto dele é
  // barra. Por isso a conta por `screenY` serve para os dois sem ramificação.
  const inset = calcularImeInsetAndroid(914.2857142857143, 536.7619018554688);
  assert.ok(Math.abs(inset - 377.528) < 0.01);
});

test("teclado exatamente na borda inferior não ocupa nada", () => {
  assert.equal(calcularImeInsetAndroid(914.29, 914.29), 0);
});

test("topo além da borda inferior devolve zero, não valor negativo", () => {
  assert.equal(calcularImeInsetAndroid(914.29, 1000), 0);
});

test("topo negativo é dado inválido e devolve zero", () => {
  assert.equal(calcularImeInsetAndroid(914.29, -20), 0);
});

test("screenY ausente devolve zero em vez de chutar altura de teclado", () => {
  assert.equal(calcularImeInsetAndroid(914.29, undefined), 0);
  assert.equal(calcularImeInsetAndroid(914.29, null), 0);
});

test("screenY não numérico devolve zero", () => {
  assert.equal(calcularImeInsetAndroid(914.29, Number.NaN), 0);
  assert.equal(calcularImeInsetAndroid(914.29, Number.POSITIVE_INFINITY), 0);
});

test("altura de tela inválida devolve zero", () => {
  assert.equal(calcularImeInsetAndroid(0, 536.76), 0);
  assert.equal(calcularImeInsetAndroid(Number.NaN, 536.76), 0);
});

test("falha aberta é impossível: o valor nunca é negativo", () => {
  const casos: Array<[number, number | null | undefined]> = [
    [914.29, 536.76],
    [914.29, 914.29],
    [914.29, 2000],
    [914.29, null],
    [0, 0],
  ];
  for (const [tela, topo] of casos) {
    assert.ok(calcularImeInsetAndroid(tela, topo) >= 0);
  }
});
