import { ReactNode, useMemo } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useDularColors } from "@/hooks/useDularColors";
import { useThemeStore } from "@/stores/useThemeStore";
import { spacing } from "@/theme";

// Extra bottom breathing room when scroll content lives above a floating bottom nav.
export const BOTTOM_NAV_CLEARANCE = 108;

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
  /** When scroll=true, adds BOTTOM_NAV_CLEARANCE at the end of scroll content */
  withBottomPadding?: boolean;
  /** Wrap in KeyboardAvoidingView (iOS "padding", Android "height") */
  keyboardAvoiding?: boolean;
  /** Pull-to-refresh — only used when scroll=true */
  refreshing?: boolean;
  onRefresh?: () => void;
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
  withBottomPadding = false,
  keyboardAvoiding = false,
  refreshing,
  onRefresh,
}: Props) {
  const colors = useDularColors();
  const mode = useThemeStore((state) => state.mode);
  const s = useMemo(() => makeStyles(colors), [colors]);

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
        tintColor={colors.primary}
      />
    ) : undefined;

  const content = isScrollable ? (
    <ScrollView
      style={s.flex}
      contentContainerStyle={[
        s.scrollContent,
        withBottomPadding && { paddingBottom: BOTTOM_NAV_CLEARANCE },
        contentContainerStyle,
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
