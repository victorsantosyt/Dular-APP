import assert from "node:assert/strict";
import test from "node:test";
import { estiloDaBarraPorTema } from "../src/lib/systemNavigationBar";

/**
 * A tradução tema → estilo da barra do sistema.
 *
 * Trava a inversão que derrubou o APK v12: `setStyle` nomeia a BARRA, não os
 * botões. Pedir "dark" no tema claro deixaria a barra escura com botões
 * claros sobre a superfície clara do app — que é exatamente o caso de 1,38:1
 * de contraste medido no aparelho.
 */

test("tema claro pede barra clara, para o sistema desenhar botões escuros", () => {
  assert.equal(estiloDaBarraPorTema("light"), "light");
});

test("tema escuro pede barra escura, para o sistema desenhar botões claros", () => {
  assert.equal(estiloDaBarraPorTema("dark"), "dark");
});

test("os dois temas produzem estilos diferentes", () => {
  // Se um dia a tradução colapsar num valor só, o contraste some em um dos
  // temas sem nada quebrar — e só apareceria no aparelho.
  assert.notEqual(estiloDaBarraPorTema("light"), estiloDaBarraPorTema("dark"));
});
