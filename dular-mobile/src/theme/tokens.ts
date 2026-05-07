import { Dimensions } from "react-native";
import { shadows } from "./shadows";
import { colors, radius, spacing, typography, gradients } from "./index";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export { colors, gradients, radius, borderRadius, spacing, typography } from "./index";

export const shadow = {
  card: shadows.card,
  float: shadows.floating,
  soft: shadows.soft,
  floating: shadows.floating,
  primaryButton: shadows.primaryButton,
} as const;

export const theme = {
  colors,
  gradients,
  spacing,
  radius,
  typography,
  shadows,
  shadow,
} as const;

export function contentWidth(pct = 0.88) {
  return Math.round(SCREEN_WIDTH * pct);
}

export function vw(percent: number) {
  return (SCREEN_WIDTH * percent) / 100;
}
