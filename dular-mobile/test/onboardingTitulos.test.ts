import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { criarTipografia, ALTURA_LINHA_TITULO } from "../src/theme/escalaTipografica";

const raiz = join(import.meta.dirname, "..");
const ler = (...p: string[]) => readFileSync(join(raiz, ...p), "utf8");

/** Métrica vertical (hhea) do arquivo de fonte realmente empacotado. */
function metricaDaFonte(arquivo: string) {
  const d = readFileSync(join(raiz, "node_modules", "@expo-google-fonts", "plus-jakarta-sans", arquivo));
  const n = d.readUInt16BE(4);
  const tabela = (tag: string) => {
    for (let i = 0; i < n; i++) {
      const r = 12 + 16 * i;
      if (d.toString("latin1", r, r + 4) === tag) return d.readUInt32BE(r + 8);
    }
    throw new Error(`sem tabela ${tag}`);
  };
  const upm = d.readUInt16BE(tabela("head") + 18);
  const hhea = tabela("hhea");
  return { upm, ascender: d.readInt16BE(hhea + 4), descender: d.readInt16BE(hhea + 6), lineGap: d.readInt16BE(hhea + 8) };
}

const LARGURAS = [320, 360, 375, 390, 411, 430, 480, 600];

test("título das telas de entrada: altura de linha calculada acima da métrica da Plus Jakarta Sans Bold (cálculo, não prova de render)", () => {
  const m = metricaDaFonte("700Bold/PlusJakartaSans_700Bold.ttf");
  const natural = (m.ascender - m.descender + m.lineGap) / m.upm;
  assert.ok(natural > 1.2, `controle: métrica lida (${natural})`);
  assert.ok(ALTURA_LINHA_TITULO >= natural, `fator ${ALTURA_LINHA_TITULO} < métrica ${natural}`);
  for (const largura of LARGURAS) {
    const { fontSize, lineHeight } = criarTipografia(largura).onboardingTitleWrap;
    assert.ok(lineHeight >= fontSize * natural, `${largura}dp: ${lineHeight} < ${fontSize}×${natural.toFixed(3)}`);
  }
});

test("o valor antigo (34 sobre 28) fica abaixo dessa métrica", () => {
  const m = metricaDaFonte("700Bold/PlusJakartaSans_700Bold.ttf");
  const natural = (m.ascender - m.descender + m.lineGap) / m.upm;
  assert.ok(34 < 28 * natural);
});

test("tipografia acompanha a largura (com piso e teto) e é recalculada, não fixada na carga", () => {
  const estreita = criarTipografia(320).onboardingTitleWrap.fontSize;
  const larga = criarTipografia(430).onboardingTitleWrap.fontSize;
  assert.ok(estreita < larga, `${estreita} deveria ser menor que ${larga}`);
  assert.equal(criarTipografia(2000).onboardingTitleWrap.fontSize, 28 * 1.12, "teto de 12%");
  assert.equal(criarTipografia(100).onboardingTitleWrap.fontSize, 28 * 0.88, "piso de 12%");
  const hook = ler("src", "hooks", "useTipografia.ts");
  assert.match(hook, /useWindowDimensions\(\)/);
  assert.match(hook, /useMemo\(\(\) => tipografiaPara\(width\), \[width\]\)/);
});

test("gates fora do escopo: onboardingTitle mantém corpo 28 e altura 34 escalados como antes", () => {
  for (const largura of LARGURAS) {
    const t = criarTipografia(largura);
    const antes = (n: number) => {
      const ajustado = n + (n * (largura / 390) - n) * 0.5;
      return Math.min(n * 1.12, Math.max(n * 0.88, ajustado));
    };
    assert.equal(t.onboardingTitle.fontSize, antes(28));
    assert.equal(t.onboardingTitle.lineHeight, antes(34));
  }
  for (const gate of ["NichosGateScreen", "GeneroGateScreen", "MontadorEspecialidadesGateScreen"]) {
    const fonte = ler("src", "screens", "onboarding", `${gate}.tsx`);
    assert.match(fonte, /\.\.\.typography\.onboardingTitle,/);
    assert.doesNotMatch(fonte, /onboardingTitleWrap|useTipografia/);
  }
});

const TELAS = ["WelcomeScreen", "BenefitsScreen", "SecurityScreen", "StartScreen", "RoleSelectScreen", "LoginScreen"];

for (const tela of TELAS) {
  test(`${tela}: título quebra naturalmente, segue a largura atual e respeita a fonte do sistema`, () => {
    const fonte = ler("src", "screens", "onboarding", `${tela}.tsx`);
    const titulo = fonte.match(/<Text style=\{\[styles\.title, tipo\.onboardingTitleWrap\]\}>/g) ?? [];
    assert.equal(titulo.length, 1, "título com o tamanho da largura atual (useTipografia)");
    assert.match(fonte, /const tipo = useTipografia\(\);/);
    // Nada de esconder o problema: sem cortar em uma linha nem encolher a fonte.
    assert.doesNotMatch(fonte, /adjustsFontSizeToFit|minimumFontScale|maxFontSizeMultiplier/);
    const tagDoTitulo = fonte.slice(fonte.indexOf("<Text style={[styles.title, tipo.onboardingTitleWrap]}>"), fonte.indexOf("</Text>", fonte.indexOf("styles.title, tipo.onboardingTitleWrap")));
    assert.doesNotMatch(tagDoTitulo, /numberOfLines|allowFontScaling=\{false\}/);
    // Conteúdo rola quando a fonte ampliada não cabe.
    assert.match(fonte, /<ScrollView/);
  });
}

test("slides: botão de avançar fica fora da rolagem (sempre acessível)", () => {
  for (const tela of ["BenefitsScreen", "SecurityScreen", "StartScreen"]) {
    const fonte = ler("src", "screens", "onboarding", `${tela}.tsx`);
    const fimDaRolagem = fonte.indexOf("</ScrollView>");
    const rodape = fonte.indexOf("<View style={styles.footer}>");
    assert.ok(fimDaRolagem > 0 && rodape > fimDaRolagem, `${tela}: rodapé depois da rolagem`);
  }
});

test("seleção de perfil: título e subtítulo voltam a acompanhar a fonte de acessibilidade", () => {
  const fonte = ler("src", "screens", "onboarding", "RoleSelectScreen.tsx");
  assert.doesNotMatch(fonte, /allowFontScaling=\{false\} style=\{styles\.subtitle\}/);
  assert.doesNotMatch(fonte, /allowFontScaling=\{false\} style=\{\[?styles\.title/);
});
