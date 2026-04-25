/**
 * ScreenBackground — Fundo padrão de tela Dular
 *
 * Cor validada: #E6EDEA (sólida, sem gradiente artificial)
 * SafeAreaView incluso para evitar content sob notch/home indicator.
 */

import React, { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "@/theme/tokens";

type Props = {
  children: ReactNode;
  /** Remove padding horizontal (útil quando a tela gerencia o próprio padding) */
  noPadding?: boolean;
};

export default function ScreenBackground({ children, noPadding = false }: Props) {
  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={[styles.inner, noPadding && styles.noPadding]}>
          {children}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg, // #E6EDEA — identidade validada
  },
  safe: {
    flex: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: spacing.lg, // 18px
    paddingBottom: spacing.lg,
  },
  noPadding: {
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
});
