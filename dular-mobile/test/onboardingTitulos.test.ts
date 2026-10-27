import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { criarTipografia } from "../src/theme/escalaTipografica";

const raiz = join(import.meta.dirname, "..");
const ler = (...p: string[]) => readFileSync(join(raiz, ...p), "utf8");

// Verificações de código e cálculo. Não comprovam render no Android: a prova
// visual (antes/depois) fica com o PR.

const LARGURAS = [320, 360, 375, 390, 411, 430, 480, 600];

test("onboardingTitle mantém corpo 28 e altura 34 escalados como antes", () => {
  for (const largura of LARGURAS) {
    const t = criarTipografia(largura);
    const antes = (n: number) => {
      const ajustado = n + (n * (largura / 390) - n) * 0.5;
      return Math.min(n * 1.12, Math.max(n * 0.88, ajustado));
    };
    assert.equal(t.onboardingTitle.fontSize, antes(28));
    assert.equal(t.onboardingTitle.lineHeight, antes(34));
  }
});

test("tipografia acompanha a largura (com piso e teto) e é recalculada, não fixada na carga", () => {
  const estreita = criarTipografia(320).onboardingTitle.fontSize;
  const larga = criarTipografia(430).onboardingTitle.fontSize;
  assert.ok(estreita < larga, `${estreita} deveria ser menor que ${larga}`);
  assert.equal(criarTipografia(2000).onboardingTitle.fontSize, 28 * 1.12, "teto de 12%");
  assert.equal(criarTipografia(100).onboardingTitle.fontSize, 28 * 0.88, "piso de 12%");
  const hook = ler("src", "hooks", "useTipografia.ts");
  assert.match(hook, /useWindowDimensions\(\)/);
  assert.match(hook, /useMemo\(\(\) => tipografiaPara\(width\), \[width\]\)/);
});

const TELAS = ["WelcomeScreen", "BenefitsScreen", "SecurityScreen", "StartScreen"];

for (const tela of TELAS) {
  test(`${tela}: título segue a largura atual, quebra linha e respeita a fonte do sistema`, () => {
    const fonte = ler("src", "screens", "onboarding", `${tela}.tsx`);
    const abertura = "<Text style={[styles.title, tipo.onboardingTitle]}>";
    assert.equal(fonte.split(abertura).length - 1, 1, "título com o tamanho da largura atual (useTipografia)");
    assert.match(fonte, /const tipo = useTipografia\(\);/);
    const inicio = fonte.indexOf(abertura);
    const tagDoTitulo = fonte.slice(inicio, fonte.indexOf("</Text>", inicio));
    assert.doesNotMatch(tagDoTitulo, /numberOfLines|allowFontScaling=\{false\}|adjustsFontSizeToFit|minimumFontScale|maxFontSizeMultiplier/);
    assert.match(fonte, /<ScrollView/);
  });
}

test("slides: botão de avançar fica fora da rolagem", () => {
  for (const tela of ["BenefitsScreen", "SecurityScreen", "StartScreen"]) {
    const fonte = ler("src", "screens", "onboarding", `${tela}.tsx`);
    const fimDaRolagem = fonte.indexOf("</ScrollView>");
    const rodape = fonte.indexOf("<View style={styles.footer}>");
    assert.ok(fimDaRolagem > 0 && rodape > fimDaRolagem, `${tela}: rodapé depois da rolagem`);
  }
});

test("fora do escopo: gates, login e seleção de perfil seguem com o token estático", () => {
  for (const tela of ["NichosGateScreen", "GeneroGateScreen", "MontadorEspecialidadesGateScreen", "LoginScreen", "RoleSelectScreen"]) {
    const fonte = ler("src", "screens", "onboarding", `${tela}.tsx`);
    assert.match(fonte, /\.\.\.typography\.onboardingTitle,/);
    assert.doesNotMatch(fonte, /useTipografia/);
  }
});
