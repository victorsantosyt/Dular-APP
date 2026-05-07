import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@/theme";
import { DularMark } from "./DularMark";

type Props = {
  size?: "sm" | "md" | "lg";
  variant?: "color" | "white" | "purple";
  showText?: boolean;
};

const MARK_SIZE = { sm: 30, md: 40, lg: 58 };
const TEXT_SIZE = { sm: 20, md: 28, lg: 36 };

export function DularLogo({ size = "md", variant = "color", showText = true }: Props) {
  const white = variant === "white";
  return (
    <View style={styles.row}>
      <DularMark size={MARK_SIZE[size]} variant={variant} />
      {showText ? (
        <Text style={[styles.text, { fontSize: TEXT_SIZE[size], color: white ? colors.white : colors.primaryDeep }]}>
          dular
        </Text>
      ) : null}
    </View>
  );
}

export default DularLogo;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  text: {
    fontWeight: "900",
    letterSpacing: 0,
  },
});
