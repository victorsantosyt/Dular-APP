import React, { ReactNode, useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useDularColors } from "@/hooks/useDularColors";
import { radius, shadows, spacing } from "@/theme";

type Variant = "purple" | "pink" | "danger";
type ThemeColors = ReturnType<typeof useDularColors>;

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

function gradientFor(variant: Variant, colors: ThemeColors): readonly [string, string] {
  // Resolve dinamicamente: usa variantes "Dark" do tema corrente pra garantir
  // contraste apropriado em light e dark mode (versões dark dessas chaves
  // são mais escuras pra evitar saturação excessiva no fundo escuro).
  switch (variant) {
    case "purple":
      return [colors.primary, colors.primaryDark];
    case "pink":
      return [colors.pink, colors.pinkDark];
    case "danger":
      return [colors.danger, colors.dangerDark];
  }
}

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
  const colors = useDularColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [pressed && styles.pressed, disabled && styles.disabled, style]}
    >
      <LinearGradient
        colors={gradientFor(variant, colors)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.button}
      >
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

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
}
