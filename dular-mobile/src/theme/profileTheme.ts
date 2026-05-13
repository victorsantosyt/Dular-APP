/**
 * profileTheme.ts — Central palette resolver for role + gender combinations.
 *
 * No color conditionals should be scattered across screens — always call getProfileTheme().
 */

export type ProfileRole = "EMPREGADOR" | "DIARISTA" | "MONTADOR";
export type Genero = "FEMININO" | "MASCULINO" | null | undefined;

type GetProfileThemeArgs = {
  role?: string | null;
  genero?: Genero;
};

export type ProfileTheme = {
  primary: string;
  primaryDark: string;
  /** Versão clarinha do primary — usada em gradients de hero (do primary indo
   *  para primaryLight). Distinto de primarySoft, que é uma tonalidade quase
   *  branca para backgrounds de ícone. */
  primaryLight: string;
  primarySoft: string;
  background: string;
  backgroundSoft: string;
  textAccent: string;
  gradient: readonly [string, string];
  border: string;
  icon: string;
  tabActive: string;
  tabInactive: string;
};

const EMPREGADOR_THEME: ProfileTheme = {
  primary: "#7B5CFA",
  primaryDark: "#5A35E6",
  primaryLight: "#9B87FF",
  primarySoft: "#F4F0FF",
  background: "#FBFAFF",
  backgroundSoft: "#EFE9FF",
  textAccent: "#6B46F2",
  gradient: ["#7B5CFA", "#9B87FF"] as const,
  border: "#DED4FF",
  icon: "#7B5CFA",
  tabActive: "#7B5CFA",
  tabInactive: "#9B94A8",
};

const FEMININO_THEME: ProfileTheme = {
  primary: "#F7658B",
  primaryDark: "#E94D78",
  primaryLight: "#FF8FB0",
  primarySoft: "#FFF1F5",
  background: "#FFFBFD",
  backgroundSoft: "#FFE7EF",
  textAccent: "#D93D68",
  gradient: ["#F7658B", "#FF8FB0"] as const,
  border: "#FFD3E0",
  icon: "#F7658B",
  tabActive: "#F7658B",
  tabInactive: "#9B94A8",
};

const MASCULINO_THEME: ProfileTheme = {
  primary: "#4FA38F",
  primaryDark: "#2E6E61",
  primaryLight: "#7DCBB5",
  primarySoft: "#EAF7F3",
  background: "#FBFFFD",
  backgroundSoft: "#E1F2ED",
  textAccent: "#24594E",
  gradient: ["#4FA38F", "#7DCBB5"] as const,
  border: "#CBE7DF",
  icon: "#3D8A78",
  tabActive: "#4FA38F",
  tabInactive: "#8EA09B",
};

/**
 * Returns the brand palette for the given role + gender combination.
 *
 * Accepts either getProfileTheme({ role, genero }) or the legacy
 * getProfileTheme(role, genero) call shape so existing screens keep working.
 *
 * Gender has priority over role. Fallbacks when gender is absent:
 *   DIARISTA  → Feminino palette
 *   MONTADOR  → Masculino palette
 *   EMPREGADOR (or unknown) → Empregador palette
 */
export function getProfileTheme(
  input: GetProfileThemeArgs | string | null | undefined,
  generoArg?: Genero,
): ProfileTheme {
  const role = typeof input === "object" && input !== null ? input.role : input;
  const genero = typeof input === "object" && input !== null ? input.genero : generoArg;

  if (genero === "FEMININO") return FEMININO_THEME;
  if (genero === "MASCULINO") return MASCULINO_THEME;

  if (role === "EMPREGADOR") return EMPREGADOR_THEME;
  if (role === "DIARISTA") return FEMININO_THEME;
  if (role === "MONTADOR") return MASCULINO_THEME;

  return EMPREGADOR_THEME;
}
