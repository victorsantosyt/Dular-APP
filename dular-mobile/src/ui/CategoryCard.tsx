/**
 * CategoryCard — Card de categoria de serviço
 *
 * Card branco, border-radius 20px, emoji + label Nunito 700.
 * Estado selected: borda verde + fundo verde-claro.
 */

import React, { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadow } from "@/theme/tokens";

type Props = {
  icon: ReactNode;
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export function CategoryCard({ icon, label, selected, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        selected && styles.selected,
        pressed && styles.pressed,
        shadow.card,
      ]}
    >
      <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
        {icon}
      </View>
      <Text
        style={[styles.label, selected && styles.labelSelected]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.xl, // 20px
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.stroke,
  },
  selected: {
    borderColor: colors.green,
    backgroundColor: colors.greenLight,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.greenLight,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapSelected: {
    backgroundColor: "#d4f0e3",
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.ink,
    textAlign: "center",
    lineHeight: 16,
  },
  labelSelected: {
    color: colors.greenDark,
  },
});
