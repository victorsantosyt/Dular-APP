/**
 * Screen — Wrapper base de tela
 *
 * Aplica SafeAreaView + fundo #E6EDEA + header opcional.
 * Todas as telas devem usar este componente como raiz.
 */

import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, typography } from "@/theme/tokens";

type Props = {
  title?: string;
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  rightAction?: React.ReactNode;
  /** Padding horizontal customizado (padrão: spacing.lg = 18) */
  px?: number;
};

export function Screen({
  title,
  children,
  scroll = true,
  contentStyle,
  rightAction,
  px = spacing.lg,
}: Props) {
  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        { paddingHorizontal: px },
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        styles.flatContent,
        { paddingHorizontal: px },
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      {title ? (
        <View style={[styles.header, { paddingHorizontal: px }]}>
          <Text style={styles.headerTitle}>{title}</Text>
          {rightAction}
        </View>
      ) : null}
      {inner}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: colors.bg,
  },
  headerTitle: {
    ...typography.h2,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 32,
    gap: 12,
  },
  flatContent: {
    flex: 1,
    paddingTop: 8,
    paddingBottom: 32,
  },
});
