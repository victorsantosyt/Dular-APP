import assert from "node:assert/strict";
import test from "node:test";
import { getScrollBottomClearance } from "../src/lib/screenLayout";

/**
 * Conta do espaço reservado no fim do conteúdo.
 *
 * Trava os dois defeitos medidos no aparelho: o respiro fixo que deixava o
 * conteúdo embaixo da barra do sistema num Stack, e o risco oposto — somar o
 * inset por cima da altura da BottomNav, que já o inclui, e abrir um vão de
 * mais de cem pixels no fim das listas das abas.
 */

test("Stack em três botões soma o inset do sistema ao respiro da tela", () => {
  // 28 de respiro + 126 da barra de três botões.
  assert.equal(
    getScrollBottomClearance({ basePadding: 28, systemInset: 126, bottomTabBarHeight: 0 }),
    154,
  );
});

test("Stack em gestos reserva menos, porque a barra é menor", () => {
  assert.equal(
    getScrollBottomClearance({ basePadding: 28, systemInset: 39, bottomTabBarHeight: 0 }),
    67,
  );
});

test("aba usa a altura publicada da BottomNav e NÃO soma o inset de novo", () => {
  // A barra desenha por cima do inset: a altura medida já o contém. Somar os
  // dois daria 28 + 76 + 126 = 230 e deixaria um vão visível no fim da lista.
  assert.equal(
    getScrollBottomClearance({ basePadding: 28, systemInset: 126, bottomTabBarHeight: 76 }),
    104,
  );
});

test("sem barra inferior, o respiro da tela fica como estava", () => {
  assert.equal(
    getScrollBottomClearance({ basePadding: 28, systemInset: 0, bottomTabBarHeight: 0 }),
    28,
  );
});

test("altura da barra ainda não medida cai no ramo do sistema", () => {
  // No primeiro layout a BottomNav publica 0. Reservar o inset é o mínimo
  // correto nesse instante, e o valor sobe quando a medida real chega.
  assert.equal(
    getScrollBottomClearance({ basePadding: 28, systemInset: 126, bottomTabBarHeight: 0 }),
    154,
  );
});

test("valores negativos nunca encolhem a reserva", () => {
  // Inset negativo não existe no Android, mas um cálculo intermediário pode
  // produzir um: o resultado não pode ficar menor que o respiro da tela.
  assert.equal(
    getScrollBottomClearance({ basePadding: 28, systemInset: -10, bottomTabBarHeight: 0 }),
    28,
  );
  assert.equal(
    getScrollBottomClearance({ basePadding: -5, systemInset: 126, bottomTabBarHeight: 0 }),
    126,
  );
  assert.equal(
    getScrollBottomClearance({ basePadding: 28, systemInset: 126, bottomTabBarHeight: -20 }),
    154,
  );
});
