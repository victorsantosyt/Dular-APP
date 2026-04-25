/**
 * ─────────────────────────────────────────────
 *  DULAR — Design Tokens  (fonte única de verdade)
 *  Substitui: dular.ts, theme.ts e ui/tokens.ts
 * ─────────────────────────────────────────────
 */

import { Dimensions, Platform } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ── Cores ────────────────────────────────────
export const colors = {
  // Marca
  green:        "#3DC87A",   // primário — botões, ícones ativos, tab ativo
  greenDark:    "#2DB368",   // pressed / hover / gradiente
  greenLight:   "#EDF7F2",   // fundo de tags, hover de cards

  // Superfícies
  bg:           "#E6EDEA",   // fundo de TODAS as telas
  card:         "#FFFFFF",   // cards, inputs, tab bar
  cardStrong:   "#F4F7F5",   // input desabilitado / fundo secundário

  // Texto
  ink:          "#1B2D22",   // texto primário
  sub:          "#90A89B",   // texto secundário / labels inativos
  muted:        "#90A89B",   // alias para sub (compatibilidade)

  // Semânticas
  star:         "#F5A623",   // avaliação
  danger:       "#DC2626",   // erro / alerta
  success:      "#16A34A",   // sucesso

  // Bordas
  stroke:       "#E3EBE7",   // borda padrão de cards e inputs

  // Aliases de compatibilidade com código legado
  /** @deprecated use colors.green */    brand:    "#3DC87A",
  /** @deprecated use colors.ink */      text:     "#1B2D22",
  /** @deprecated use colors.card */     surface:  "#FFFFFF",
  /** @deprecated use colors.card */     surface2: "#F4F7F5",
  /** @deprecated use colors.greenDark */ primary: "#3DC87A",
  /** @deprecated use colors.greenDark */ primaryDark: "#2DB368",
  /** @deprecated use colors.stroke */   border:   "#E3EBE7",
};

// ── Raios de borda ───────────────────────────
export const radius = {
  sm:     10,   // badges, chips pequenos
  md:     14,   // inputs, search pill
  lg:     18,   // cards de conteúdo
  xl:     20,   // category cards
  btn:    22,   // botões primários (pill)
  tabbar: 28,   // tab bar flutuante
  pill:   999,  // pill completo
};

// ── Sombras ──────────────────────────────────
export const shadow = {
  /** Cards sobre fundo verde-claro */
  card: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius: 14,
    },
    android: { elevation: 3 },
  }) as object,

  /** Tab Bar e modais flutuantes */
  float: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius: 36,
    },
    android: { elevation: 10 },
  }) as object,

  /** Alias legado */
  soft: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius: 14,
    },
    android: { elevation: 3 },
  }) as object,
};

// ── Tipografia ───────────────────────────────
export const typography = {
  /** Títulos de tela */
  h1: { fontSize: 27, fontWeight: "900" as const, color: colors.ink, letterSpacing: -0.5 },
  /** Nomes / títulos de card */
  h2: { fontSize: 17, fontWeight: "800" as const, color: colors.ink, letterSpacing: -0.2 },
  /** Subtítulos de seção */
  h3: { fontSize: 15, fontWeight: "700" as const, color: colors.ink },
  /** Corpo de texto */
  body: { fontSize: 14, fontWeight: "600" as const, color: colors.ink },
  /** Texto secundário / descrições */
  sub: { fontSize: 12, fontWeight: "600" as const, color: colors.sub },
  /** Labels de botão */
  btn: { fontSize: 13, fontWeight: "800" as const, color: "#FFFFFF" },
  /** Labels de tab bar */
  tab: { fontSize: 11, fontWeight: "700" as const },
};

// ── Espaçamentos ─────────────────────────────
export const spacing = {
  xs:          4,
  sm:          8,
  md:          12,
  lg:          18,   // padding horizontal padrão de todas as telas
  xl:          24,   // gap entre seções
  cardGap:     10,   // gap entre cards empilhados
};

// ── Layout helpers ───────────────────────────
export function contentWidth(pct = 0.88) {
  return Math.round(SCREEN_WIDTH * pct);
}

export function vw(percent: number) {
  return (SCREEN_WIDTH * percent) / 100;
}
