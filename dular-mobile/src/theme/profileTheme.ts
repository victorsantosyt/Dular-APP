/**
 * profileTheme.ts — Central palette resolver for role + gender combinations.
 *
 * No color conditionals should be scattered across screens — always call getProfileTheme().
 */

export type ProfileRole = "EMPREGADOR" | "DIARISTA" | "MONTADOR";
export type Genero = "FEMININO" | "MASCULINO" | null | undefined;

export type ProfileTheme = {
  primary: string;
  primaryDark: string;
  primarySoft: string;
  backgroundSoft: string;
  textAccent: string;
  gradient: readonly [string, string];
};

const EMPREGADOR_THEME: ProfileTheme = {
  primary: "#7B5CFA",
  primaryDark: "#5A35E6",
  primarySoft: "#F4F0FF",
  backgroundSoft: "#EFE9FF",
  textAccent: "#6B46F2",
  gradient: ["#7B5CFA", "#9B87FF"] as const,
};

const FEMININO_THEME: ProfileTheme = {
  primary: "#F7658B",
  primaryDark: "#E94D78",
  primarySoft: "#FFF1F5",
  backgroundSoft: "#FFE7EF",
  textAccent: "#D93D68",
  gradient: ["#F7658B", "#FF8FB0"] as const,
};

const MASCULINO_THEME: ProfileTheme = {
  primary: "#4FA38F",
  primaryDark: "#2E6E61",
  primarySoft: "#EAF7F3",
  backgroundSoft: "#E1F2ED",
  textAccent: "#24594E",
  gradient: ["#4FA38F", "#3D8A78"] as const,
};

/**
 * Returns the brand palette for the given role + gender combination.
 *
 * Accepts any string for role so callers can pass store role values directly
 * without casting. Unknown roles fall back to EMPREGADOR palette.
 *
 * Fallbacks when gender is absent:
 *   DIARISTA  → Feminino palette
 *   MONTADOR  → Masculino palette
 *   EMPREGADOR (or unknown) → Empregador palette
 */
export function getProfileTheme(
  role: string | null | undefined,
  genero: Genero,
): ProfileTheme {
  if (role === "EMPREGADOR") return EMPREGADOR_THEME;
  if (role === "DIARISTA")
    return genero === "MASCULINO" ? MASCULINO_THEME : FEMININO_THEME;
  if (role === "MONTADOR")
    return genero === "FEMININO" ? FEMININO_THEME : MASCULINO_THEME;
  // safety fallback
  return EMPREGADOR_THEME;
}
