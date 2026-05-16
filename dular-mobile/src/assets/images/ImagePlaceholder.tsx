import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { colors, gradients, radius } from "@/theme";

type Props = {
  icon?: AppIconName;
  height?: number;
};

export function LocalVisualAsset({ icon = "Image", height = 180 }: Props) {
  return (
    <LinearGradient colors={gradients.softBackground} style={[styles.wrap, { height }]}>
      <View style={styles.bubble}>
        <AppIcon name={icon} color="purple" size={42} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  bubble: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
});
