import { Dimensions } from "react-native";
import { colors, radius, shadows } from "./index";

const { width } = Dimensions.get("window");

export const dularColors = {
  bgTop: colors.background,
  bgBottom: colors.lavenderSoft,
  bg: colors.background,
  surface: colors.surface,
  surface2: colors.lavenderSoft,
  text: colors.textPrimary,
  muted: colors.textSecondary,
  primary: colors.primary,
  primary2: colors.primaryDark,
  tealCardLeft: colors.primary,
  tealCardRight: colors.primaryDark,
  success: colors.success,
  danger: colors.danger,
  border: colors.border,
  shadow: colors.shadow,
} as const;

export const dularRadius = {
  sm: radius.sm,
  md: radius.md,
  lg: radius.lg,
  xl: radius.xl,
} as const;

export const dularShadow = {
  ios: shadows.card,
  android: shadows.card,
} as const;

export function contentWidth() {
  return width * 0.86;
}

export function vw(percent: number) {
  return (width * percent) / 100;
}
