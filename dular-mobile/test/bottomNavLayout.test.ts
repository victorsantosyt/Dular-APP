import assert from "node:assert/strict";
import test from "node:test";
import {
  getBottomNavContentPadding,
  getBottomNavSafeAreaPadding,
} from "../src/navigation/bottomNavLayout";

test("preserva o inset inferior completo da barra em aparelhos com área de gesto", () => {
  assert.equal(getBottomNavSafeAreaPadding(-1), 8);
  assert.equal(getBottomNavSafeAreaPadding(0), 8);
  assert.equal(getBottomNavSafeAreaPadding(24), 24);
  assert.equal(getBottomNavSafeAreaPadding(48), 48);
});

test("usa a altura medida da tab bar para liberar o fim do conteúdo", () => {
  assert.equal(getBottomNavContentPadding(-1, 24), 24);
  assert.equal(getBottomNavContentPadding(76, 24), 100);
  assert.equal(getBottomNavContentPadding(0, 24), 24);
});
