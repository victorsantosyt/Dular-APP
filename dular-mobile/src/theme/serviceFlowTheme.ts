import { colors } from "@/theme/colors";
import { getProfileTheme } from "@/theme/profileTheme";

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
  const theme = getProfileTheme({ role: "EMPREGADOR" });

  return {
    primary: theme.primary,
    primaryDark: theme.primaryDark,
    primarySoft: theme.primarySoft,
    background: colors.background,
    surface: colors.surface,
    border: theme.border,
    textAccent: theme.textAccent,
    gradient: theme.gradient,
    icon: theme.icon,
    inactive: colors.textMuted,
  };
}
