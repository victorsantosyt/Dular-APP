import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calcularPaddingInternoModal, RESPIRO_INTERNO_MODAL } from "../src/lib/keyboardInset";

/**
 * Modal "Editar perfil" do empregador.
 *
 * Medido no APK v28, navegação em três botões: o ScrollView tinha 12 dp de
 * conteúdo abaixo do "Salvar alterações" e o resto do padding ficava no
 * container, atrás da barra do Android. A sombra do botão era cortada numa
 * linha reta e sobravam 11,8 dp até a barra — o mesmo defeito dos sheets da
 * diarista antes do v26.
 */

const CODIGO = readFileSync(
  join(import.meta.dirname, "..", "src", "screens", "empregador", "EmpregadorPerfil.tsx"),
  "utf8",
)
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, " ")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\/\/[^\n]*/g, " ")
  .replace(/\s+/g, " ");

const MODAL = CODIGO.slice(CODIGO.indexOf("<Modal"), CODIGO.indexOf("</Modal>"));

test("o container do modal reserva só a região do sistema", () => {
  assert.match(MODAL, /s\.modalSheet, \{ maxHeight: "85%", paddingBottom: insets\.bottom \}/);
});

test("o respiro do design fica dentro da rolagem, com o helper dos sheets", () => {
  assert.match(
    MODAL,
    /contentContainerStyle=\{\{ paddingBottom: calcularPaddingInternoModal\(\{ safeAreaInset: insets\.bottom, insetJaReservadoFora: true, ?\}\), ?\}\}/,
  );
  assert.equal(calcularPaddingInternoModal({ safeAreaInset: 48, insetJaReservadoFora: true }), RESPIRO_INTERNO_MODAL);
  assert.equal(RESPIRO_INTERNO_MODAL, 24);
});

test("o CTA do modal é flat, como os dos perfis da diarista", () => {
  const cta = MODAL.slice(MODAL.lastIndexOf("<DButton"), MODAL.indexOf("/>", MODAL.lastIndexOf("<DButton")));
  assert.match(cta, /Salvar alterações/);
  assert.match(cta, /\bflat\b/);
});
