import { colors } from "@/theme/colors";

export type ServiceFlowTipo = "DIARISTA" | "MONTADOR";

export type ServiceFlowTheme = {
  primary: string;
  primaryDark: string;
  primarySoft: string;
  background: string;
  surface: string;
  border: string;
  textAccent: string;
  gradient: readonly [string, string];
  icon: string;
  inactive: string;
};

export function getServiceFlowTheme(tipo?: ServiceFlowTipo | null): ServiceFlowTheme {
  if (tipo === "MONTADOR") {
    return {
      primary: colors.tealDark,
      primaryDark: colors.tealDark,
      primarySoft: colors.tealSoft,
      background: colors.background,
      surface: colors.surface,
      border: colors.tealSoft,
      textAccent: colors.tealDark,
      gradient: [colors.tealDark, colors.teal],
      icon: colors.tealDark,
      inactive: colors.textMuted,
    };
  }

  return {
    primary: colors.primary,
    primaryDark: colors.primaryDark,
    primarySoft: colors.lavenderSoft,
    background: colors.background,
    surface: colors.surface,
    border: colors.border,
    textAccent: colors.primary,
    gradient: [colors.primary, colors.primaryDark],
    icon: colors.primary,
    inactive: colors.textMuted,
  };
}
