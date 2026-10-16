import type { ProfileTheme } from "@/theme/profileTheme";
import type { SafeScoreOverview } from "@/api/safeScoreOverviewApi";

export type SafeScoreEmblemState = "unavailable" | "restricted" | "observation" | "verified" | "neutral";

export function getSafeScoreEmblemState(data: SafeScoreOverview | null): SafeScoreEmblemState {
  if (data?.restrito || data?.reputation?.bloqueado) return "restricted";
  if (!data?.reputation) return "unavailable";
  if (data.status === "Em Observação") return "observation";
  return data.identidade === "VERIFICADO" ? "verified" : "neutral";
}

export const IDENTITY_LABELS: Record<SafeScoreOverview["identidade"], string> = {
  VERIFICADO: "Verificada",
  PENDENTE: "Pendente",
  REPROVADO: "Reprovada",
  NAO_ENVIADO: "Não enviada",
};

export function getSafeScoreBackground(theme: ProfileTheme): string {
  const blend = (offset: number) => Math.round(
    parseInt(theme.background.slice(offset, offset + 2), 16) * 0.6 +
    parseInt(theme.primarySoft.slice(offset, offset + 2), 16) * 0.4,
  ).toString(16).padStart(2, "0");
  return `#${blend(1)}${blend(3)}${blend(5)}`;
}

// ── Acentos suavizados, só desta tela ───────────────────────────────────────
// A referência aprovada usa destaques menos saturados que a paleta do app.
// Para não mexer nas outras telas, o ajuste é derivado aqui: cores com
// saturação acima de SATURACAO_MAXIMA (roxo e rosa) descem para perto dela;
// o verde e o neutro, já sóbrios, ficam como estão. O texto de destaque é
// escurecido, se preciso, até 4,5:1 sobre todos os fundos onde aparece.

const SATURACAO_MAXIMA = 0.6;
const FATOR_DE_SATURACAO = 0.72;
export const CONTRASTE_MINIMO = 4.5;

function hexParaRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}

function rgbParaHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function rgbParaHsl([r, g, b]: [number, number, number]): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslParaHex(h: number, s: number, l: number): string {
  if (s === 0) return rgbParaHex(l, l, l);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const canal = (t: number) => {
    const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return rgbParaHex(canal(h + 1 / 3), canal(h), canal(h - 1 / 3));
}

export function saturacao(hex: string): number {
  return rgbParaHsl(hexParaRgb(hex))[1];
}

export function contraste(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = hexParaRgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** Reduz a saturação de uma cor muito saturada; as demais voltam iguais. */
export function suavizarAcento(hex: string): string {
  const [h, s, l] = rgbParaHsl(hexParaRgb(hex));
  if (s <= SATURACAO_MAXIMA) return hex;
  return hslParaHex(h, Math.max(SATURACAO_MAXIMA, s * FATOR_DE_SATURACAO), l);
}

/** Fundos sobre os quais o texto de destaque desta tela aparece. */
export function fundosDoTexto(theme: ProfileTheme, fundoDoCartao = "#FFFFFF"): string[] {
  return [fundoDoCartao, theme.primarySoft, getSafeScoreBackground(theme)];
}

/** Tema desta tela: acentos suavizados, texto de destaque com contraste ≥ 4,5:1. */
export function suavizarTemaSafeScore(theme: ProfileTheme, fundoDoCartao = "#FFFFFF"): ProfileTheme {
  const fundos = fundosDoTexto(theme, fundoDoCartao);
  let texto = suavizarAcento(theme.textAccent);
  const [h, s] = rgbParaHsl(hexParaRgb(texto));
  let l = rgbParaHsl(hexParaRgb(texto))[2];
  while (Math.min(...fundos.map((f) => contraste(texto, f))) < CONTRASTE_MINIMO && l > 0) {
    l = Math.max(0, l - 0.01);
    texto = hslParaHex(h, s, l);
  }
  return {
    ...theme,
    primary: suavizarAcento(theme.primary),
    primaryLight: suavizarAcento(theme.primaryLight),
    primaryDark: suavizarAcento(theme.primaryDark),
    icon: suavizarAcento(theme.icon),
    textAccent: texto,
  };
}
