import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Modal transparente não pode usar `animationType="slide"`.
 *
 * No Android o slide desliza a JANELA inteira do modal, não só o sheet. Como o
 * fundo escuro mora nessa mesma janela, ele virava uma cortina cinza de borda
 * reta: subia da base cobrindo a tela e o sheet só aparecia no fim; ao fechar,
 * descia atravessando a tela. Gravado no APK v29 (screenrecord, quadros de
 * 33 ms) no "Editar perfil" do empregador e no sheet "Dados profissionais" da
 * diarista. Com `fade` o fundo aparece e some no lugar.
 */

const RAIZ = join(import.meta.dirname, "..", "src");

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

function modais(codigo: string): string[] {
  const achados: string[] = [];
  let i = codigo.indexOf("<Modal");
  while (i >= 0) {
    const fim = codigo.indexOf(">", i);
    achados.push(codigo.slice(i, fim + 1).replace(/\s+/g, " "));
    i = codigo.indexOf("<Modal", fim);
  }
  return achados;
}

test("nenhum Modal transparente usa animationType slide", () => {
  const violacoes: string[] = [];
  let total = 0;
  for (const arq of arquivos(RAIZ)) {
    for (const tag of modais(readFileSync(arq, "utf8"))) {
      if (!/\btransparent\b/.test(tag)) continue;
      total++;
      if (/animationType="slide"/.test(tag)) violacoes.push(`${relative(RAIZ, arq)}: ${tag}`);
    }
  }
  assert.ok(total >= 7, `esperava ao menos os 7 modais transparentes, achei ${total}`);
  assert.deepEqual(violacoes, []);
});
