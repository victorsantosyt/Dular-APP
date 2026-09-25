import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { radius, raioDoBotao } from "../src/theme/radius";

/**
 * Raio do botão preenchido.
 *
 * O preenchimento e o wrapper que carrega a sombra precisam concordar. No
 * Android a `elevation` é recortada pelo `borderRadius` do View que a declara,
 * então um raio maior no wrapper deixa as quinas do botão para fora da sombra.
 *
 * Foi medido no APK v25: "Salvar área", 115 px de altura, preenchimento com
 * raio ~47 px (radius.lg = 18dp × 2,625) contra sombra com ~57 px (pill, metade
 * da altura).
 *
 * Os ~10 px de diferença são entre os RAIOS. O defeito visível é bem menor:
 * dois arcos tangentes às mesmas arestas se afastam no máximo ~2,9 px na
 * diagonal. Na tela isso apareceu como halo de ~1 px no canto contra ~2-3 px
 * no meio da aresta — a quina sem sombra atrás. No v26 o canto foi para ~4 px.
 */

test("flat usa o raio de card, não a pílula", () => {
  assert.equal(raioDoBotao(true), radius.lg);
});

test("sem flat continua pílula", () => {
  assert.equal(raioDoBotao(false), radius.pill);
  assert.equal(raioDoBotao(undefined), radius.pill);
});

test("os dois raios são realmente diferentes — por isso a divergência aparecia", () => {
  assert.notEqual(radius.lg, radius.pill);
});

// ── Trava estrutural ────────────────────────────────────────────────────────
// Os testes acima provam que a função devolve o valor certo, mas não impedem
// que alguém volte a escrever o raio à mão num dos dois lugares — que foi
// exatamente o que tinha acontecido. Esta parte lê o componente.
//
// Ela olha o CÓDIGO, não o texto: comentários saem e os espaços são colapsados,
// então reformatar o arquivo não quebra o teste. E não trava a quantidade de
// declarações: o que importa é que toda declaração passe pela função, não que
// existam exatamente duas.

const FONTE = readFileSync(
  join(import.meta.dirname, "..", "src", "components", "ui", "DButton.tsx"),
  "utf8",
);

const CODIGO = FONTE.replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\/\/[^\n]*/g, " ")
  .replace(/\s+/g, " ");

test("todo borderRadius do DButton vem de raioDoBotao(flat)", () => {
  const valores = [...CODIGO.matchAll(/borderRadius:\s*([^,}]+)/g)].map((m) => m[1].trim());
  assert.ok(valores.length >= 2, "esperava o raio do preenchimento e o da sombra");
  for (const valor of valores) {
    assert.equal(valor, "raioDoBotao(flat)", `borderRadius escrito à mão: ${valor}`);
  }
});

test("toda chamada de gradientShadow passa flat — senão a sombra ignora o modo", () => {
  const chamadas = [...CODIGO.matchAll(/(?<!function )gradientShadow\(([^)]*)\)/g)].map((m) => m[1]);
  assert.ok(chamadas.length >= 2, "esperava as duas chamadas de gradientShadow");
  for (const args of chamadas) {
    // `filter` derruba o item vazio de uma vírgula final, que o formatador põe
    // quando quebra a chamada em várias linhas.
    const lista = args.split(",").map((a) => a.trim()).filter(Boolean);
    assert.equal(lista.at(-1), "flat", `chamada sem flat: gradientShadow(${args})`);
  }
});

test("gradientShadow declara o parâmetro flat", () => {
  assert.match(CODIGO, /function gradientShadow\([^)]*flat\?: boolean[^)]*\)/);
});

// ── Sombra: chapado e gradiente não usam a mesma ─────────────────────────────
// O botão `flat` herdava `shadows.primaryButton` (elevation 8), pensada para o
// gradiente. Sobre o branco do sheet isso virava um halo colorido de 54 px
// abaixo do CTA — medido no APK v26. O gradiente mantém a sombra forte.

test("a sombra do DButton depende de flat: soft no chapado, primaryButton no gradiente", () => {
  assert.match(
    CODIGO,
    /\.\.\.\(\s*flat\s*\?\s*shadows\.soft\s*:\s*shadows\.primaryButton\s*\)/,
    "o chapado voltou a usar a mesma sombra do gradiente",
  );
});

test("o DButton usa exatamente estes dois tokens de sombra", () => {
  const usados = [...new Set([...CODIGO.matchAll(/shadows\.(\w+)/g)].map((m) => m[1]))];
  assert.deepEqual(usados.sort(), ["primaryButton", "soft"]);
});
