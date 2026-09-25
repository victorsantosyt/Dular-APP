import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Saída do Paywall ("Agora não" / "Ver outros planos").
 *
 * Era um rodapé fixo fora da rolagem, com borda. Medido no APK v27: a rolagem
 * cortava o último plano ("Pro Anual") numa linha seca logo acima do rodapé,
 * e o card perdia a borda de baixo. A saída passou a ser o último item da
 * lista, com cara de card e sem borda.
 *
 * Lê o fonte, sem comentários e com espaços colapsados, para não depender de
 * formatação.
 */

const CODIGO = readFileSync(join(import.meta.dirname, "..", "src", "screens", "PaywallScreen.tsx"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, " ")
  .replace(/\/\/[^\n]*/g, " ")
  .replace(/\s+/g, " ");

function estilo(nome: string): string {
  const m = CODIGO.match(new RegExp(`\\b${nome}: \\{([^}]*)\\}`));
  assert.ok(m, `estilo ${nome} não encontrado`);
  return m[1];
}

test("não existe mais rodapé fixo fora da rolagem", () => {
  assert.doesNotMatch(CODIGO, /\brodape\b/);
});

test("as duas saídas ficam dentro do ScrollView", () => {
  const dentro = CODIGO.slice(CODIGO.indexOf("<ScrollView"), CODIGO.indexOf("</ScrollView>"));
  assert.match(dentro, /Agora não/);
  assert.match(dentro, /Ver outros planos/);
});

test("a saída não tem borda e usa o fundo do card Gratuito", () => {
  const sec = estilo("secundario");
  assert.doesNotMatch(sec, /borderWidth/);
  assert.doesNotMatch(sec, /borderColor/);
  assert.match(sec, /backgroundColor: colors\.background/);
  assert.match(estilo("atual"), /backgroundColor: colors\.background/);
});

test("a saída tem o mesmo raio dos cards de plano", () => {
  assert.match(estilo("secundario"), /borderRadius: radius\.lg/);
  assert.match(estilo("opcao"), /borderRadius: radius\.lg/);
});
