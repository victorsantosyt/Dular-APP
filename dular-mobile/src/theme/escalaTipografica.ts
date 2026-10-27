import type { TextStyle } from "react-native";

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
 * A largura NÃO é lida uma vez só: mesmo em retrato ela muda com o app aberto
 * (tamanho de exibição do Android, janela dividida, dobráveis). As telas que
 * precisam acompanhar usam `useTipografia()` (hooks/useTipografia), que
 * recalcula com `useWindowDimensions`. `typography` continua existindo como
 * fotografia da largura na carga, para os estilos estáticos.
 */
export const LARGURA_BASE = 390; // iPhone 14/15 — referência do design
const FATOR = 0.5;
const LIMITE = 0.12;

/** Altura de linha mínima dos títulos, em múltiplos do corpo (ver onboardingTitleWrap). */
export const ALTURA_LINHA_TITULO = 1.32;

export function alturaDeLinhaDeTitulo(corpo: number): number {
  return Math.ceil(corpo * ALTURA_LINHA_TITULO);
}

function escalar(tamanho: number, largura: number, arredondar: (v: number) => number): number {
  const proporcao = largura / LARGURA_BASE;
  const ajustado = tamanho + (tamanho * proporcao - tamanho) * FATOR;
  const min = tamanho * (1 - LIMITE);
  const max = tamanho * (1 + LIMITE);
  const limitado = Math.min(Math.max(ajustado, min), max);
  // Arredonda para o pixel do aparelho: valor fracionário deixa o texto
  // levemente borrado em densidades não inteiras.
  return arredondar(limitado);
}

const base = {} satisfies TextStyle;

/** Tokens tipográficos para uma largura de janela. Puro: sem React Native em execução. */
export function criarTipografia(largura: number, arredondar: (v: number) => number = (v) => v) {
  const e = (tamanho: number) => escalar(tamanho, largura, arredondar);
  return {
    fontFamily: {
      regular: "PlusJakartaSans_400Regular",
      medium: "PlusJakartaSans_500Medium",
      bold: "PlusJakartaSans_700Bold",
    },

    hero: {
      ...base,
      fontSize: e(34),
      lineHeight: e(40),
      fontWeight: "700" as const,
      letterSpacing: -0.7,
    } satisfies TextStyle,

    h1: {
      ...base,
      fontSize: e(28),
      lineHeight: e(34),
      fontWeight: "700" as const,
      letterSpacing: -0.4,
    } satisfies TextStyle,

    h2: {
      ...base,
      fontSize: e(24),
      lineHeight: e(30),
      fontWeight: "700" as const,
      letterSpacing: -0.25,
    } satisfies TextStyle,

    h3: {
      ...base,
      fontSize: e(20),
      lineHeight: e(26),
      fontWeight: "600" as const,
      letterSpacing: -0.1,
    } satisfies TextStyle,

    /**
     * Título das telas de onboarding. Existe como token porque as quatro telas
     * têm StyleSheets separadas e os tamanhos tinham divergido.
     *
     * Mantido como estava porque os gates (nichos, gênero, especialidades)
     * também o usam; as seis telas de entrada usam `onboardingTitleWrap`.
     */
    onboardingTitle: {
      ...base,
      fontSize: e(28),
      lineHeight: e(34),
      fontWeight: "700" as const,
      letterSpacing: -0.4,
    } satisfies TextStyle,

    /**
     * Título das seis telas de entrada (boas-vindas, três slides, login e
     * perfil). QUEBRA em quantas linhas precisar (sem `numberOfLines`, sem
     * encolher a fonte): fonte ampliada ou tela estreita viram mais linhas, e
     * o conteúdo rola.
     *
     * A altura de linha é proporcional ao corpo e fica acima da métrica
     * vertical da Plus Jakarta Sans Bold (1,26×). Folga calculada, não
     * comprovada na tela: o texto pode estar saindo na fonte do sistema.
     */
    onboardingTitleWrap: {
      ...base,
      fontSize: e(28),
      lineHeight: alturaDeLinhaDeTitulo(e(28)),
      fontWeight: "700" as const,
      letterSpacing: -0.4,
    } satisfies TextStyle,

    title: {
      ...base,
      fontSize: e(18),
      lineHeight: e(24),
      fontWeight: "600" as const,
    } satisfies TextStyle,

    body: {
      ...base,
      fontSize: e(16),
      lineHeight: e(24),
      fontWeight: "400" as const,
    } satisfies TextStyle,

    bodyMedium: {
      ...base,
      fontSize: e(16),
      lineHeight: e(24),
      fontWeight: "500" as const,
    } satisfies TextStyle,

    bodySm: {
      ...base,
      fontSize: e(14),
      lineHeight: e(20),
      fontWeight: "400" as const,
    } satisfies TextStyle,

    bodySmMedium: {
      ...base,
      fontSize: e(14),
      lineHeight: e(20),
      fontWeight: "500" as const,
    } satisfies TextStyle,

    caption: {
      ...base,
      fontSize: e(12),
      lineHeight: e(16),
      fontWeight: "500" as const,
    } satisfies TextStyle,

    button: {
      ...base,
      fontSize: e(16),
      lineHeight: e(20),
      fontWeight: "600" as const,
    } satisfies TextStyle,

    buttonSm: {
      ...base,
      fontSize: e(14),
      lineHeight: e(18),
      fontWeight: "600" as const,
    } satisfies TextStyle,

    label: {
      ...base,
      fontSize: e(12),
      lineHeight: e(16),
      fontWeight: "600" as const,
      letterSpacing: 0.2,
      textTransform: "uppercase" as const,
    } satisfies TextStyle,

    // Compatibility aliases for older screens.
    h4: {
      ...base,
      fontSize: e(18),
      lineHeight: e(24),
      fontWeight: "600" as const,
    } satisfies TextStyle,

    bodyMd: {
      ...base,
      fontSize: e(14),
      lineHeight: e(20),
      fontWeight: "400" as const,
    } satisfies TextStyle,

    sub: {
      ...base,
      fontSize: e(14),
      lineHeight: e(20),
      fontWeight: "500" as const,
    } satisfies TextStyle,

    small: {
      ...base,
      fontSize: e(12),
      lineHeight: e(16),
      fontWeight: "500" as const,
    } satisfies TextStyle,

    btn: {
      ...base,
      fontSize: e(16),
      lineHeight: e(20),
      fontWeight: "600" as const,
    } satisfies TextStyle,

    tab: {
      ...base,
      fontSize: e(12),
      lineHeight: e(16),
      fontWeight: "600" as const,
    } satisfies TextStyle,
  } as const;
}
