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
};

export function DCard({ elevation = "low", style, ...rest }: Props) {
  return (
    <View
      {...rest}
      style={[
        styles.base,
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
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stroke,
    padding: 14,
  },
});
