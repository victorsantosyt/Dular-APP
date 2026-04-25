/**
 * Layout — Helpers de layout Dular
 *
 * Mantém a API existente (ScreenBg, HeaderShell, CenterWrap, useDularContainerWidth)
 * mas corrige as cores para a identidade validada.
 */

import React from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, contentWidth } from "@/theme/tokens";

const { width: SCREEN_W } = Dimensions.get("window");

export function useDularContainerWidth() {
  return contentWidth(0.88);
}

// ── ScreenBg ─────────────────────────────────────────────────────────────────
// Fundo sólido #E6EDEA — sem gradiente artificial (identidade validada).

export function ScreenBg({ children }: { children: React.ReactNode }) {
  return <View style={styles.screenBg}>{children}</View>;
}

// ── HeaderShell ───────────────────────────────────────────────────────────────
// Cabeçalho com fundo idêntico ao da tela, sem gradiente separado.

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
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top + extraTop,
          paddingBottom: extraBottom,
        },
      ]}
    >
      {children}
    </View>
  );
}

// ── CenterWrap ────────────────────────────────────────────────────────────────

export function CenterWrap({
  children,
  mt = 18,
}: {
  children: React.ReactNode;
  mt?: number;
}) {
  const cw = useDularContainerWidth();
  return (
    <View style={{ width: cw, alignSelf: "center", marginTop: mt }}>
      {children}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screenBg: {
    flex: 1,
    backgroundColor: colors.bg, // #E6EDEA
  },
  header: {
    width: "100%",
    backgroundColor: colors.bg,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
});
