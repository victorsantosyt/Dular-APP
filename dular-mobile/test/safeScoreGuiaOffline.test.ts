import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SAFE_SCORE_GUIDE } from "../../shared/safescore/guia";

/**
 * "Como funciona o SafeScore" abre sem rede: o texto vem do módulo
 * compartilhado com o servidor, não de /api/me/safescore.
 */

const TELA = readFileSync(join(import.meta.dirname, "..", "src", "screens", "perfil", "SafeScoreGuideScreen.tsx"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\/\/[^\n]*/g, " ");

test("a tela do guia usa o módulo compartilhado e não chama a API", () => {
  assert.match(TELA, /from "\.\.\/\.\.\/\.\.\/\.\.\/shared\/safescore\/guia"/);
  assert.doesNotMatch(TELA, /getSafeScoreOverview|useSafeScoreResource|ResourceFeedback|api\./);
});

test("o guia compartilhado tem os sete blocos, todos com título e texto", () => {
  assert.equal(SAFE_SCORE_GUIDE.length, 7);
  for (const bloco of SAFE_SCORE_GUIDE) {
    assert.ok(bloco.title.trim() && bloco.text.trim());
  }
});
