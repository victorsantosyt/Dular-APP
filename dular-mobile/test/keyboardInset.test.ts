import assert from "node:assert/strict";
import test from "node:test";
import {
  RESPIRO_INTERNO_MODAL,
  calcularDeslocamentoInferiorModal,
  calcularImeInsetAndroid,
  calcularPaddingInternoModal,
} from "../src/lib/keyboardInset";

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

test("modal fechado usa somente o inset seguro de três botões", () => {
  assert.equal(calcularDeslocamentoInferiorModal(48, 0), 48);
});

test("modal fechado em gestos não inventa inset", () => {
  assert.equal(calcularDeslocamentoInferiorModal(0, 0), 0);
});

test("IME substitui o inset seguro em vez de duplicá-lo", () => {
  assert.equal(calcularDeslocamentoInferiorModal(48, 377.528), 377.528);
});

test("fechar o IME restaura exatamente o deslocamento inicial", () => {
  const inicial = calcularDeslocamentoInferiorModal(48, 0);
  assert.equal(calcularDeslocamentoInferiorModal(48, 377.528), 377.528);
  assert.equal(calcularDeslocamentoInferiorModal(48, 0), inicial);
});

test("deslocamentos inválidos nunca geram compensação residual", () => {
  assert.equal(calcularDeslocamentoInferiorModal(Number.NaN, Number.NaN), 0);
  assert.equal(calcularDeslocamentoInferiorModal(-48, -300), 0);
});

// ── Respiro interno dos modais ancorados no rodapé ──────────────────────────

test("no Android o sheet carrega só o respiro — o overlay já reservou a região", () => {
  // Três botões: inset 48. A folga visível tem de ser o respiro inteiro.
  assert.equal(
    calcularPaddingInternoModal({ safeAreaInset: 48, insetJaReservadoFora: true }),
    RESPIRO_INTERNO_MODAL,
  );
  // Gestos: inset 14,857. Mesmo resultado — a folga não depende do inset.
  assert.equal(
    calcularPaddingInternoModal({ safeAreaInset: 14.857142857, insetJaReservadoFora: true }),
    RESPIRO_INTERNO_MODAL,
  );
});

test("a folga visível é constante entre três botões e gestos", () => {
  // Folga visível = deslocamento externo + padding interno − inset do sistema.
  const folga = (inset: number) =>
    calcularDeslocamentoInferiorModal(inset, 0) +
    calcularPaddingInternoModal({ safeAreaInset: inset, insetJaReservadoFora: true }) -
    inset;
  assert.equal(folga(48), RESPIRO_INTERNO_MODAL);
  assert.equal(folga(14.857142857), RESPIRO_INTERNO_MODAL);
  assert.equal(folga(0), RESPIRO_INTERNO_MODAL);
});

test("a fórmula antiga entregava metade — é o defeito medido no v24", () => {
  // `Math.max(inset, 12) + 12` menos o inset, que é o que o olho enxergava.
  const antiga = (inset: number) => Math.max(inset, 12) + 12 - inset;
  assert.equal(antiga(48), 12);
  assert.ok(Math.abs(antiga(14.857142857) - 12) < 1e-9);
  // 12,19 e 13,33 dp medidos no aparelho batem com esses 12 dp de projeto.
  assert.ok(antiga(48) < RESPIRO_INTERNO_MODAL);
});

test("sem reserva externa (iOS) o sheet cobre o inset e ainda soma o respiro", () => {
  assert.equal(
    calcularPaddingInternoModal({ safeAreaInset: 34, insetJaReservadoFora: false }),
    34 + RESPIRO_INTERNO_MODAL,
  );
  // Aparelho sem inset inferior: o respiro sozinho já garante o mínimo.
  assert.equal(
    calcularPaddingInternoModal({ safeAreaInset: 0, insetJaReservadoFora: false }),
    RESPIRO_INTERNO_MODAL,
  );
});

test("inset inválido ou negativo não encolhe o respiro", () => {
  for (const ruim of [Number.NaN, -10, Number.POSITIVE_INFINITY]) {
    assert.equal(
      calcularPaddingInternoModal({ safeAreaInset: ruim, insetJaReservadoFora: false }),
      RESPIRO_INTERNO_MODAL,
    );
  }
});

test("respiro explícito é respeitado, e nunca fica negativo", () => {
  assert.equal(
    calcularPaddingInternoModal({ safeAreaInset: 48, insetJaReservadoFora: true, respiro: 32 }),
    32,
  );
  assert.equal(
    calcularPaddingInternoModal({ safeAreaInset: 48, insetJaReservadoFora: true, respiro: -5 }),
    0,
  );
});

test("o respiro canônico é o mesmo das telas já aprovadas em QA físico", () => {
  // PerfilPublicoLayout com footer e FlowFooter usam spacing.xl = 24.
  assert.equal(RESPIRO_INTERNO_MODAL, 24);
});
