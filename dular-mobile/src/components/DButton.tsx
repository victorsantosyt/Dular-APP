/**
 * DButton — Botão primário Dular (substitui DButton + DularButton)
 *
 * Variantes:
 *   primary  → verde sólido  (padrão)
 *   outline  → borda verde, fundo transparente
 *   ghost    → sem borda, sem fundo
 *
 * Migração:
 *   DularButton variant="primary"  → <DButton />
 *   DularButton variant="ghost"    → <DButton variant="outline" />
 *   DButton     variant="secondary" → <DButton variant="outline" />
 */

import React from "react";
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";
import { colors, radius, typography } from "@/theme/tokens";

export type DButtonVariant = "primary" | "outline" | "ghost";

type Props = PressableProps & {
  title: string;
  loading?: boolean;
  variant?: DButtonVariant;
  style?: StyleProp<ViewStyle>;
};

export function DButton({
  title,
  onPress,
  disabled,
  loading,
  variant = "primary",
  style,
  ...rest
}: Props) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? "#FFFFFF" : colors.green}
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.label,
            variant === "primary"  && styles.labelPrimary,
            variant === "outline"  && styles.labelOutline,
            variant === "ghost"    && styles.labelGhost,
            isDisabled             && styles.labelDisabled,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 44,
    borderRadius: radius.btn,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    borderWidth: 1.5,
  },

  // ── Variantes ──────────────────────────────
  primary: {
    backgroundColor: colors.green,
    borderColor: colors.green,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 3,
  },
  outline: {
    backgroundColor: "transparent",
    borderColor: colors.green,
  },
  ghost: {
    backgroundColor: "transparent",
    borderColor: "transparent",
  },

  // ── Estados ────────────────────────────────
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },

  // ── Labels ─────────────────────────────────
  label: {
    ...typography.btn,
    letterSpacing: 0.1,
  },
  labelPrimary: {
    color: "#FFFFFF",
  },
  labelOutline: {
    color: colors.green,
  },
  labelGhost: {
    color: colors.green,
  },
  labelDisabled: {
    opacity: 0.7,
  },
});
