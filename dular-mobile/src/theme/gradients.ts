import { colors } from "./colors";

export const gradients = {
  primary: ["#A67AF2", "#7B4EDB", "#6F43C9"] as const,
  button: ["#9B6EF3", "#7B4EDB"] as const,
  soft: ["#F8F3FF", "#EFE3FF"] as const,
  card: ["#FFFFFF", "#F8F3FF"] as const,

  // Compatibility aliases
  purple: [colors.primary, colors.primaryDark] as const,
  pink: [colors.notification, colors.accentDark] as const,
  danger: [colors.danger, colors.dangerDark] as const,
  softBackground: [colors.background, colors.surface] as const,
} as const;
