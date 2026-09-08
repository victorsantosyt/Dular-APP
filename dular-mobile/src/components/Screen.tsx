/**
 * Screen — Wrapper base de tela
 *
 * Aplica SafeAreaView + fundo Dular Soft Premium UI + header opcional.
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
  contentContainerStyle?: ViewStyle;
  /**
   * Ação à ESQUERDA do título — é onde mora o voltar. As duas plataformas
   * colocam "voltar" no canto superior esquerdo (o gesto do iOS nasce na
   * borda esquerda; no Android o botão fica à esquerda), então o botão à
   * direita contrariava a memória do usuário.
   */
  leftAction?: React.ReactNode;
  /** Ação à direita — reservada para avançar/confirmar, não para voltar. */
  rightAction?: React.ReactNode;
  padded?: boolean;
  /** Padding horizontal customizado (padrão: spacing.screenPadding = 24) */
  px?: number;
};

export function Screen({
  title,
  children,
  scroll = true,
  contentStyle,
  contentContainerStyle,
  leftAction,
  rightAction,
  padded = true,
  px = spacing.screenPadding,
}: Props) {
  const horizontalPadding = padded ? px : 0;
  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        { paddingHorizontal: horizontalPadding },
        contentStyle,
        contentContainerStyle,
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
        { paddingHorizontal: horizontalPadding },
        contentStyle,
        contentContainerStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      {title ? (
        <View style={[styles.header, { paddingHorizontal: horizontalPadding }]}>
          {leftAction}
          {/* `flex: 1` no título: empurra a ação da direita para a borda sem
              depender de space-between, que com três filhos jogava o título
              para o meio. */}
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
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: colors.background,
  },
  headerTitle: {
    ...typography.h2,
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 120,
    gap: spacing.itemGap,
  },
  flatContent: {
    flex: 1,
    paddingTop: 8,
    paddingBottom: 120,
  },
});
