/**
 * DCard — Card Dular (substitui DCard + DularCard)
 *
 * Prop elevation:
 *   "low"    → sombra sutil para cards sobre fundo verde-claro  (padrão)
 *   "float"  → sombra profunda para modais e drawers
 */

import React from "react";
import { StyleSheet, View, ViewProps } from "react-native";
import { colors, radius, shadow } from "@/theme/tokens";

type Props = ViewProps & {
  elevation?: "low" | "float";
  variant?: "default" | "soft" | "elevated" | "outline";
};

export function DCard({ elevation = "low", variant = "default", style, ...rest }: Props) {
  return (
    <View
      {...rest}
      style={[
        styles.base,
        styles[variant],
        elevation === "float" ? shadow.float : shadow.card,
        style,
      ]}
    />
  );
}

// Alias de compatibilidade
export const DularCard = DCard;

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.stroke,
    padding: 16,
  },
  default: {},
  soft: {
    backgroundColor: colors.lavenderSoft,
  },
  elevated: {},
  outline: {
    shadowOpacity: 0,
  },
});
