/**
 * DularBadge — Badge de status/label
 *
 * Variantes pré-definidas:
 *   success  → verde (online, verificado, aprovado)
 *   warning  → amarelo (pendente, aguardando)
 *   danger   → vermelho (recusado, problema)
 *   neutral  → cinza (inativo, arquivado)
 *
 * Ou passe color + bg para customizar.
 */

import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, radius } from "@/theme/tokens";

type Variant = "success" | "warning" | "danger" | "neutral";

type Props = {
  text: string;
  variant?: Variant;
  /** Sobrescreve cor do texto */
  color?: string;
  /** Sobrescreve cor de fundo */
  bg?: string;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

const VARIANTS: Record<Variant, { bg: string; color: string }> = {
  success: { bg: colors.greenLight,  color: colors.greenDark },
  warning: { bg: "#FEF9C3",          color: "#92400E" },
  danger:  { bg: "#FEE2E2",          color: colors.danger },
  neutral: { bg: "#F1F5F3",          color: colors.sub },
};

export function DularBadge({
  text,
  variant = "success",
  color,
  bg,
  icon,
  style,
}: Props) {
  const v = VARIANTS[variant];
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: bg ?? v.bg },
        style,
      ]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={[styles.label, { color: color ?? v.color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    gap: 5,
  },
  icon: {},
  label: {
    fontSize: 12,
    fontWeight: "700",
  },
});
