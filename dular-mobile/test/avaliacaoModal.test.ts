import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * AvaliacaoModal — usado pelos três perfis ao avaliar um serviço.
 *
 * Tinha o padrão que cortava a sombra dos botões: o respiro inferior no
 * container (`Math.max(insets.bottom, spacing.md) + spacing.md`) e o "Enviar"
 * com a sombra forte do gradiente. Não foi reproduzido no aparelho — nenhuma
 * conta de teste tinha serviço elegível —, mas é o mesmo padrão medido no
 * modal de perfil do empregador (v28) e nos sheets da diarista (v25).
 */

const CODIGO = readFileSync(join(import.meta.dirname, "..", "src", "components", "ui", "AvaliacaoModal.tsx"), "utf8")
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, " ")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\/\/[^\n]*/g, " ")
  .replace(/\s+/g, " ");

function botao(rotulo: string): string {
  const i = CODIGO.indexOf(`label="${rotulo}"`);
  assert.ok(i > 0, `botão ${rotulo} não encontrado`);
  const ini = CODIGO.lastIndexOf("<DButton", i);
  return CODIGO.slice(ini, CODIGO.indexOf("/>", i));
}

test("o container reserva só a região do sistema", () => {
  assert.match(CODIGO, /s\.sheet, \{ paddingBottom: insets\.bottom \}/);
  assert.doesNotMatch(CODIGO, /Math\.max\(insets\.bottom/);
});

test("o respiro fica dentro da rolagem, com o helper dos sheets", () => {
  assert.match(
    CODIGO,
    /contentContainerStyle=\{\[ s\.sheetContent, \{ paddingBottom: calcularPaddingInternoModal\(\{ safeAreaInset: insets\.bottom, insetJaReservadoFora: true, ?\}\), ?\}, ?\]\}/,
  );
});

test("o Enviar é flat — sem a sombra forte do gradiente", () => {
  assert.match(botao("Enviar"), /\bflat\b/);
});

test("Cancelar e Enviar têm o mesmo formato lado a lado", () => {
  assert.match(botao("Cancelar"), /\bflat\b/);
});
