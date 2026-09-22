import { ReactNode, useContext, useMemo } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useDularColors } from "@/hooks/useDularColors";
import { useThemeStore } from "@/stores/useThemeStore";
import { spacing } from "@/theme";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { getScrollBottomClearance } from "@/lib/screenLayout";

type EdgeValue = "top" | "bottom" | "left" | "right";
type ThemeColors = ReturnType<typeof useDularColors>;

type Props = {
  children: ReactNode;
  /** Wrap content in a ScrollView */
  scroll?: boolean;
  /** @deprecated alias for scroll — kept for backward compat */
  scrollable?: boolean;
  /** Background color of the safe area + content. Override do tema; cor explícita
   *  passada externamente tem precedência sobre `colors.background`. */
  backgroundColor?: string;
  /** Style applied to the SafeAreaView root */
  style?: ViewStyle;
  /** Style applied to the scroll contentContainer (when scroll=true) */
  contentContainerStyle?: ViewStyle;
  /** Which safe-area edges to inset. Default: top, left, right */
  safeAreaEdges?: EdgeValue[];
  /** Status bar appearance. "auto" (default) deriva do tema; "light"/"dark"
   *  forçam o estilo independentemente do modo. */
  statusBarStyle?: "dark" | "light" | "auto";
  /**
   * @deprecated Não faz mais diferença, e é aceita só para não quebrar as
   * dezesseis telas que a passam. A reserva do fim do conteúdo passou a ser
   * automática: quando a tela está numa aba, o `BottomTabBarHeightContext`
   * informa a altura medida da BottomNav; fora dela, vale o inset do sistema.
   * Depender de uma prop opcional era o bug — quem não a passava terminava
   * embaixo da barra.
   */
  withBottomPadding?: boolean;
  /** Wrap in KeyboardAvoidingView (iOS "padding", Android "height") */
  keyboardAvoiding?: boolean;
  /** Pull-to-refresh — only used when scroll=true */
  refreshing?: boolean;
  onRefresh?: () => void;
  refreshTintColor?: string;
};

export function DScreen({
  children,
  scroll,
  scrollable,
  backgroundColor,
  style,
  contentContainerStyle,
  safeAreaEdges = ["top", "left", "right"],
  statusBarStyle = "dark",
  keyboardAvoiding = false,
  refreshing,
  onRefresh,
  refreshTintColor,
}: Props) {
  const colors = useDularColors();
  const mode = useThemeStore((state) => state.mode);
  const s = useMemo(() => makeStyles(colors), [colors]);
  const bottomTabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
  const insets = useSafeAreaInsets();

  const isScrollable = scroll ?? scrollable ?? false;
  const bg = backgroundColor ?? colors.background;

  const safeStyle = [s.safe, { backgroundColor: bg }, style];

  // Status bar: se o caller passou explicitamente "light", respeita.
  // Se passou "dark" (default histórico) e o tema atual é dark, vira "light"
  // pra texto da status bar permanecer legível. "auto" segue o tema do app.
  const effectiveStatusBarStyle =
    statusBarStyle === "auto"
      ? mode === "dark"
        ? "light"
        : "dark"
      : statusBarStyle === "dark" && mode === "dark"
      ? "light"
      : statusBarStyle;

  const refreshControl =
    isScrollable && onRefresh ? (
      <RefreshControl
        refreshing={refreshing ?? false}
        onRefresh={onRefresh}
        tintColor={refreshTintColor ?? colors.primary}
        colors={[refreshTintColor ?? colors.primary]}
      />
    ) : undefined;

  // A reserva não depende mais de `withBottomPadding`: uma tela Stack que não
  // passava a prop ficava com respiro fixo e terminava embaixo da barra do
  // sistema. Agora o contexto decide sozinho qual barra está no rodapé.
  const bottomClearance = getScrollBottomClearance({
    basePadding:
      (StyleSheet.flatten([s.scrollContent, contentContainerStyle])
        ?.paddingBottom as number) ?? spacing.xl,
    systemInset: insets.bottom,
    bottomTabBarHeight,
  });

  const content = isScrollable ? (
    <ScrollView
      style={s.flex}
      contentContainerStyle={[
        s.scrollContent,
        contentContainerStyle,
        // Por último, sempre: o respiro visual da tela continua valendo, e a
        // reserva da barra inferior não pode ser perdida por um
        // `contentContainerStyle` que redefina `paddingBottom`.
        { paddingBottom: bottomClearance },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[s.flex, contentContainerStyle]}>{children}</View>
  );

  const body = keyboardAvoiding ? (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      {content}
    </KeyboardAvoidingView>
  ) : (
    content
  );

  return (
    <SafeAreaView style={safeStyle} edges={safeAreaEdges}>
      <StatusBar style={effectiveStatusBarStyle} />
      {body}
    </SafeAreaView>
  );
}

function makeStyles(_colors: ThemeColors) {
  // _colors reservado: o background é aplicado inline (suporta override externo).
  // Esta função existe pra manter o padrão consistente com os outros componentes
  // e pra acomodar futuras cores temáticas no shell da tela.
  return StyleSheet.create({
    safe: {
      flex: 1,
    },
    flex: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.screenPadding,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xl,
    },
  });
}
