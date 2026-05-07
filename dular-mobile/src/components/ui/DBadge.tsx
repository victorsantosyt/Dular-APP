import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius } from "@/theme";

type BadgeType = "default" | "success" | "warning" | "error" | "info" | "accent";

type Props = {
  label: string;
  type?: BadgeType;
};

const map: Record<BadgeType, { bg: string; fg: string }> = {
  default: { bg: colors.lavenderSoft, fg: colors.primary },
  success: { bg: colors.successSoft, fg: colors.success },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  error:   { bg: colors.dangerSoft,   fg: colors.danger },
  info:    { bg: colors.infoLight,    fg: colors.info },
  accent:  { bg: colors.dangerSoft,  fg: colors.notification },
};

export function DBadge({ label, type = "default" }: Props) {
  const { bg, fg } = map[type];
  return (
    <View style={[s.wrap, { backgroundColor: bg }]}>
      <View style={[s.dot, { backgroundColor: fg }]} />
      <Text style={[s.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    minHeight: 18,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  text: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
});
