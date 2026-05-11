import React, { ReactNode } from "react";
import { Pressable, StyleSheet, View, ViewStyle } from "react-native";
import { colors, radius, shadows, spacing } from "@/theme";

type Props = {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  onPress?: () => void;
  variant?: "default" | "soft" | "elevated" | "outline";
};

export function DCard({ children, style, onPress, variant = "default" }: Props) {
  const cardStyle = [s.card, s[variant], style as ViewStyle];
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [cardStyle, pressed && { opacity: 0.92 }]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={cardStyle}>{children}</View>;
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  default: {
    ...shadows.card,
  },
  soft: {
    backgroundColor: colors.lavenderSoft,
    ...shadows.soft,
  },
  elevated: {
    ...shadows.card,
  },
  outline: {
    ...shadows.soft,
  },
});
