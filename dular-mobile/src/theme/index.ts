import { colors } from "./colors";
import { gradients } from "./gradients";
import { radius } from "./radius";
import { shadows } from "./shadows";
import { spacing } from "./spacing";
import { typography } from "./typography";

export { colors } from "./colors";
export { darkColors } from "./darkColors";
export { gradients } from "./gradients";
export { radius, borderRadius } from "./radius";
export { shadows } from "./shadows";
export { spacing } from "./spacing";
export { typography } from "./typography";

export const theme = {
  colors,
  gradients,
  spacing,
  radius,
  typography,
  shadows,
} as const;
