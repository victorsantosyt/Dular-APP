import React, { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, gradients, radius, shadows, spacing } from "@/theme";

type Variant = "purple" | "pink" | "danger";

type Props = {
  title: string;
  iconRight?: ReactNode;
  iconLeft?: ReactNode;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
  style?: ViewStyle;
};

const GRADIENTS: Record<Variant, readonly [string, string]> = {
  purple: gradients.purple,
  pink: gradients.pink,
  danger: gradients.danger,
};

export function GradientButton({
  title,
  iconRight,
  iconLeft,
  variant = "purple",
  loading,
  disabled,
  onPress,
  style,
}: Props) {
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [pressed && styles.pressed, disabled && styles.disabled, style]}>
      <LinearGradient colors={GRADIENTS[variant]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.button}>
        {loading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <>
            {iconLeft ? <View style={styles.icon}>{iconLeft}</View> : null}
            <Text style={styles.title}>{title}</Text>
            {iconRight ? <View style={styles.icon}>{iconRight}</View> : null}
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    ...shadows.primaryButton,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.white,
  },
  icon: {
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.55,
  },
});
