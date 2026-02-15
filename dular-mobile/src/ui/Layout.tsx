import React from "react";
import { Dimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

export function useDularContainerWidth() {
  return Math.round(width * 0.88);
}

export function ScreenBg({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient colors={["#E3EEE5", "#E9F0ED"]} style={{ flex: 1 }}>
      {children}
    </LinearGradient>
  );
}

export function HeaderShell({
  children,
  extraTop = 14,
  extraBottom = 20,
}: {
  children: React.ReactNode;
  extraTop?: number;
  extraBottom?: number;
}) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={["#E1EFE6", "#E7F1ED"]}
      style={{
        width: "100%",
        paddingTop: insets.top + extraTop,
        paddingBottom: extraBottom,
        borderBottomLeftRadius: 26,
        borderBottomRightRadius: 26,
      }}
    >
      {children}
    </LinearGradient>
  );
}

export function CenterWrap({ children, mt = 18 }: { children: React.ReactNode; mt?: number }) {
  const cw = useDularContainerWidth();
  return (
    <View style={{ width: cw, alignSelf: "center", marginTop: mt }}>
      {children}
    </View>
  );
}
