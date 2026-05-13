/**
 * DStateViews — global loading / empty / error / skeleton states.
 * All follow theme tokens so every screen has the same visual quality.
 */
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { colors, radius, shadows, spacing } from "@/theme";
import { AppIcon, type AppIconName } from "./AppIcon";

// ─── DLoadingState ───────────────────────────────────────────────────────────

type LoadingProps = {
  text?: string;
  color?: string;
  style?: ViewStyle;
};

export function DLoadingState({ text, color = colors.primary, style }: LoadingProps) {
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 600, useNativeDriver: true }),
      ]),
    ).start();
  }, [pulse]);

  return (
    <View style={[s.center, style]}>
      <Animated.View style={[s.loadingDot, { backgroundColor: color, opacity: pulse }]} />
      <Animated.View style={[s.loadingDot, s.loadingDotMid, { backgroundColor: color, opacity: pulse }]} />
      <Animated.View style={[s.loadingDot, { backgroundColor: color, opacity: pulse }]} />
      {text ? <Text style={s.loadingText}>{text}</Text> : null}
    </View>
  );
}

// ─── DSkeletonCard ───────────────────────────────────────────────────────────

type SkeletonProps = {
  height?: number;
  count?: number;
  style?: ViewStyle;
};

export function DSkeletonCard({ height = 76, count = 1, style }: SkeletonProps) {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.9, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 750, useNativeDriver: true }),
      ]),
    ).start();
  }, [pulse]);

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Animated.View
          key={i}
          style={[
            s.skeleton,
            { height, marginBottom: i < count - 1 ? spacing.sm : 0 },
            { opacity: pulse },
            style,
          ]}
        />
      ))}
    </>
  );
}

// ─── DEmptyState ─────────────────────────────────────────────────────────────

type EmptyProps = {
  icon?: AppIconName;
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
  accentColor?: string;
  softBg?: string;
  style?: ViewStyle;
};

export function DEmptyState({
  icon = "Search",
  title,
  subtitle,
  action,
  onAction,
  accentColor = colors.primaryLight,
  softBg = colors.lavender,
  style,
}: EmptyProps) {
  return (
    <View style={[s.stateCard, s.emptyCard, { backgroundColor: softBg }, style]}>
      <View style={[s.emptyIconWrap, { backgroundColor: colors.surface }]}>
        <AppIcon name={icon} size={28} color={accentColor} strokeWidth={1.5} />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={s.emptySub}>{subtitle}</Text> : null}
      {action ? (
        <Pressable onPress={onAction} style={[s.emptyAction, { backgroundColor: accentColor }]}>
          <Text style={s.emptyActionLabel}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ─── DErrorState ─────────────────────────────────────────────────────────────

type ErrorProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  style?: ViewStyle;
};

export function DErrorState({
  title = "Algo deu errado",
  message,
  onRetry,
  style,
}: ErrorProps) {
  return (
    <View style={[s.stateCard, s.errorCard, style]}>
      <View style={s.errorIconWrap}>
        <AppIcon name="AlertTriangle" size={22} color={colors.danger} strokeWidth={2} />
      </View>
      <View style={s.errorTexts}>
        <Text style={s.errorTitle}>{title}</Text>
        {message ? <Text style={s.errorMsg}>{message}</Text> : null}
      </View>
      {onRetry ? (
        <Pressable onPress={onRetry} style={s.retryBtn}>
          <Text style={s.retryLabel}>Tentar novamente</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  center: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.xl,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  loadingDotMid: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  loadingText: {
    position: "absolute",
    bottom: spacing.sm,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "500",
  },

  skeleton: {
    borderRadius: radius.xl,
    backgroundColor: colors.lavenderSoft,
  },

  stateCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  emptyCard: {
    backgroundColor: colors.lavenderSoft,
    alignItems: "center",
    gap: spacing.sm,
    borderColor: "transparent",
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.lavender,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
  emptyAction: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  emptyActionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.white,
  },

  errorCard: {
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  errorIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.dangerSoft,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  errorTexts: {
    flex: 1,
  },
  errorTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.danger,
  },
  errorMsg: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 3,
    lineHeight: 15,
  },
  retryBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerSoft,
    flexShrink: 0,
  },
  retryLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.danger,
  },
});
