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
import { colors, radius, shadow, spacing, typography } from "@/theme/tokens";

export type DButtonVariant = "primary" | "secondary" | "outline" | "ghost";

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
          color={variant === "primary" ? colors.textOnPrimary : colors.primary}
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.label,
            variant === "primary"  && styles.labelPrimary,
            variant === "secondary" && styles.labelSecondary,
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
    minHeight: 52,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    borderWidth: 1.5,
  },

  // ── Variantes ──────────────────────────────
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...shadow.primaryButton,
  },
  secondary: {
    backgroundColor: colors.lavenderSoft,
    borderColor: colors.lavenderSoft,
  },
  outline: {
    backgroundColor: "transparent",
    borderColor: colors.primary,
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
    letterSpacing: 0,
  },
  labelPrimary: {
    color: colors.textOnPrimary,
  },
  labelOutline: {
    color: colors.primary,
  },
  labelSecondary: {
    color: colors.primary,
  },
  labelGhost: {
    color: colors.primary,
  },
  labelDisabled: {
    opacity: 0.7,
  },
});
