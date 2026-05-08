import { ReactElement, ReactNode } from "react";
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
import { colors, spacing } from "@/theme";

// Extra bottom breathing room when scroll content lives above a floating bottom nav.
export const BOTTOM_NAV_CLEARANCE = 108;

type EdgeValue = "top" | "bottom" | "left" | "right";

type Props = {
  children: ReactNode;
  /** Wrap content in a ScrollView */
  scroll?: boolean;
  /** @deprecated alias for scroll — kept for backward compat */
  scrollable?: boolean;
  /** Background color of the safe area + content */
  backgroundColor?: string;
  /** Style applied to the SafeAreaView root */
  style?: ViewStyle;
  /** Style applied to the scroll contentContainer (when scroll=true) */
  contentContainerStyle?: ViewStyle;
  /** Which safe-area edges to inset. Default: top, left, right */
  safeAreaEdges?: EdgeValue[];
  /** Status bar appearance */
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
  const isScrollable = scroll ?? scrollable ?? false;
  const bg = backgroundColor ?? colors.background;

  const safeStyle = [s.safe, { backgroundColor: bg }, style];

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
      <StatusBar style={statusBarStyle} />
      {body}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
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
