/**
 * Screen — Wrapper base de tela
 *
 * Aplica SafeAreaView + fundo Dular Soft Premium UI + header opcional.
 * Todas as telas devem usar este componente como raiz.
 */

import React, { useContext } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { useGenderTheme } from "@/hooks/useProfileTheme";
import { getScrollBottomClearance } from "@/lib/screenLayout";
import { colors, spacing, typography } from "@/theme/tokens";

type Props = {
  title?: string;
  backgroundColor?: string;
  titleColor?: string;
  compactHeader?: boolean;
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
  backgroundColor = colors.background,
  titleColor,
  compactHeader = false,
  children,
  scroll = true,
  contentStyle,
  contentContainerStyle,
  leftAction,
  rightAction,
  padded = true,
  px = spacing.screenPadding,
}: Props) {
  // Título na cor de destaque do perfil, como nas telas com cabeçalho
  // próprio — este componente serve 6 telas e era o último ponto em preto.
  const tema = useGenderTheme();
  const insets = useSafeAreaInsets();
  // `undefined` fora de uma aba — é assim que Stack e Tab se distinguem, sem
  // olhar nome de rota nem plataforma.
  const bottomTabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
  const horizontalPadding = padded ? px : 0;

  // Parte do respiro que a tela já tinha e soma o que a barra inferior ocupa.
  // Entra POR ÚLTIMO no array de estilos: um `contentStyle` da tela pode
  // ajustar o respiro visual, mas não pode apagar a reserva de safe area.
  const bottomClearance = getScrollBottomClearance({
    basePadding:
      (StyleSheet.flatten([styles.scrollContent, contentStyle, contentContainerStyle])
        ?.paddingBottom as number) ?? spacing.xl,
    systemInset: insets.bottom,
    bottomTabBarHeight,
  });

  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        { paddingHorizontal: horizontalPadding },
        contentStyle,
        contentContainerStyle,
        { paddingBottom: bottomClearance },
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
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.safe, { backgroundColor }]}>
      {title ? (
        <View style={[styles.header, { paddingHorizontal: horizontalPadding, backgroundColor }, compactHeader && styles.compactHeader]}>
          {/* Espaçador do tamanho do botão quando não há ação daquele lado:
              sem ele o título centraliza no espaço QUE SOBRA e fica deslocado
              para o lado oposto ao botão, em vez de centralizado na linha. */}
          {leftAction ?? <View style={styles.headerSlot} />}
          <Text style={[styles.headerTitle, { color: titleColor ?? tema.textAccent }]}>{title}</Text>
          {rightAction ?? <View style={styles.headerSlot} />}
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
  compactHeader: { paddingTop: 0, paddingBottom: 6 },
  headerTitle: {
    ...typography.h2,
    flex: 1,
    textAlign: "center",
  },
  /** Mesma largura do BackCircleButton. */
  headerSlot: { width: 42, height: 42 },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: spacing.xl,
    gap: spacing.itemGap,
  },
  flatContent: {
    flex: 1,
    paddingTop: 8,
    paddingBottom: spacing.xl,
  },
});
