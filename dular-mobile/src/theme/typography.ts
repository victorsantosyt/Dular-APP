import { Dimensions, PixelRatio, TextStyle } from "react-native";

/**
 * Plus Jakarta Sans, o mesmo arquivo nos dois sistemas — antes era San
 * Francisco no iOS e Inter/Roboto no Android, com métricas diferentes.
 *
 * NÃO fixamos `fontFamily` nos tokens: quem traduz `fontWeight` para o
 * arquivo do peso certo é `theme/fonte.ts`, uma vez só para o app inteiro.
 * Cravar a família aqui faria o interceptador respeitar o "regular" e todo
 * negrito sumiria no Android.
 */

/**
 * Escala tipográfica por aparelho.
 *
 * Corpo fixo não serve para a mesma tela: 24pt ocupa quase toda a largura de
 * um SE (320pt) e sobra folga num Pro Max (430pt) — texto apertado num,
 * pequeno demais no outro.
 *
 * A escala é PARCIAL de propósito (`FATOR` 0.5): proporção pura deixaria o
 * texto grande demais em tela larga e minúsculo em tela estreita. Meio
 * caminho acompanha o aparelho sem exagerar, e o teto/piso de ±12% impede
 * qualquer extremo (tablet, fonte de sistema muito ampliada).
 *
 * O app é travado em retrato (app.json), então a largura não muda em runtime
 * e ler uma vez na carga do módulo é suficiente.
 */
const LARGURA_BASE = 390; // iPhone 14/15 — referência do design
const FATOR = 0.5;
const LIMITE = 0.12;

const larguraAtual = Dimensions.get("window").width;

function escalar(tamanho: number): number {
  const proporcao = larguraAtual / LARGURA_BASE;
  const ajustado = tamanho + (tamanho * proporcao - tamanho) * FATOR;
  const min = tamanho * (1 - LIMITE);
  const max = tamanho * (1 + LIMITE);
  const limitado = Math.min(Math.max(ajustado, min), max);
  // Arredonda para o pixel do aparelho: valor fracionário deixa o texto
  // levemente borrado em densidades não inteiras.
  return PixelRatio.roundToNearestPixel(limitado);
}

const base = {} satisfies TextStyle;

export const typography = {
  fontFamily: {
    regular: "PlusJakartaSans_400Regular",
    medium: "PlusJakartaSans_500Medium",
    bold: "PlusJakartaSans_700Bold",
  },

  hero: {
    ...base,
    fontSize: escalar(34),
    lineHeight: escalar(40),
    fontWeight: "700" as const,
    letterSpacing: -0.7,
  } satisfies TextStyle,

  h1: {
    ...base,
    fontSize: escalar(28),
    lineHeight: escalar(34),
    fontWeight: "700" as const,
    letterSpacing: -0.4,
  } satisfies TextStyle,

  h2: {
    ...base,
    fontSize: escalar(24),
    lineHeight: escalar(30),
    fontWeight: "700" as const,
    letterSpacing: -0.25,
  } satisfies TextStyle,

  h3: {
    ...base,
    fontSize: escalar(20),
    lineHeight: escalar(26),
    fontWeight: "600" as const,
    letterSpacing: -0.1,
  } satisfies TextStyle,

  /**
   * Título das telas de onboarding. Existe como token porque as quatro telas
   * têm StyleSheets separadas e os tamanhos tinham divergido.
   *
   * O corpo é o da PRIMEIRA tela (28), que é a referência do fluxo. As telas
   * seguintes têm frases mais longas e usam `adjustsFontSizeToFit` com
   * `numberOfLines={1}`: cada uma encolhe só o necessário para caber numa
   * linha, em vez de quebrar. Assim as quatro partem do mesmo tamanho e ficam
   * o mais próximas possível em qualquer aparelho.
   */
  onboardingTitle: {
    ...base,
    fontSize: escalar(28),
    lineHeight: escalar(34),
    fontWeight: "700" as const,
    letterSpacing: -0.4,
  } satisfies TextStyle,

  title: {
    ...base,
    fontSize: escalar(18),
    lineHeight: escalar(24),
    fontWeight: "600" as const,
  } satisfies TextStyle,

  body: {
    ...base,
    fontSize: escalar(16),
    lineHeight: escalar(24),
    fontWeight: "400" as const,
  } satisfies TextStyle,

  bodyMedium: {
    ...base,
    fontSize: escalar(16),
    lineHeight: escalar(24),
    fontWeight: "500" as const,
  } satisfies TextStyle,

  bodySm: {
    ...base,
    fontSize: escalar(14),
    lineHeight: escalar(20),
    fontWeight: "400" as const,
  } satisfies TextStyle,

  bodySmMedium: {
    ...base,
    fontSize: escalar(14),
    lineHeight: escalar(20),
    fontWeight: "500" as const,
  } satisfies TextStyle,

  caption: {
    ...base,
    fontSize: escalar(12),
    lineHeight: escalar(16),
    fontWeight: "500" as const,
  } satisfies TextStyle,

  button: {
    ...base,
    fontSize: escalar(16),
    lineHeight: escalar(20),
    fontWeight: "600" as const,
  } satisfies TextStyle,

  buttonSm: {
    ...base,
    fontSize: escalar(14),
    lineHeight: escalar(18),
    fontWeight: "600" as const,
  } satisfies TextStyle,

  label: {
    ...base,
    fontSize: escalar(12),
    lineHeight: escalar(16),
    fontWeight: "600" as const,
    letterSpacing: 0.2,
    textTransform: "uppercase" as const,
  } satisfies TextStyle,

  // Compatibility aliases for older screens.
  h4: {
    ...base,
    fontSize: escalar(18),
    lineHeight: escalar(24),
    fontWeight: "600" as const,
  } satisfies TextStyle,

  bodyMd: {
    ...base,
    fontSize: escalar(14),
    lineHeight: escalar(20),
    fontWeight: "400" as const,
  } satisfies TextStyle,

  sub: {
    ...base,
    fontSize: escalar(14),
    lineHeight: escalar(20),
    fontWeight: "500" as const,
  } satisfies TextStyle,

  small: {
    ...base,
    fontSize: escalar(12),
    lineHeight: escalar(16),
    fontWeight: "500" as const,
  } satisfies TextStyle,

  btn: {
    ...base,
    fontSize: escalar(16),
    lineHeight: escalar(20),
    fontWeight: "600" as const,
  } satisfies TextStyle,

  tab: {
    ...base,
    fontSize: escalar(12),
    lineHeight: escalar(16),
    fontWeight: "600" as const,
  } satisfies TextStyle,
} as const;
