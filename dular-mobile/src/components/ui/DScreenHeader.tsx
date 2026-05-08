import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { colors, radius, shadows, spacing } from "@/theme";
import { AppIcon } from "./AppIcon";
import { DAvatar } from "./DAvatar";

type Props = {
  title?: string;
  subtitle?: string;
  /** URI or initials for the avatar displayed on the right side of the greeting area */
  avatarUri?: string;
  avatarInitials?: string;
  /** Show back arrow on the left */
  onBack?: () => void;
  /** Show notification bell on the right (replaces avatar when both provided, avatar takes priority) */
  onNotification?: () => void;
  notificationBadge?: number;
  /** Arbitrary right-side slot — takes priority over onNotification */
  rightAction?: ReactNode;
  /** Extra container style */
  style?: ViewStyle;
};

export function DScreenHeader({
  title,
  subtitle,
  avatarUri,
  avatarInitials,
  onBack,
  onNotification,
  notificationBadge,
  rightAction,
  style,
}: Props) {
  const showAvatar = !!(avatarUri || avatarInitials);

  return (
    <View style={[s.row, style]}>
      {/* Left: back button or spacer */}
      <View style={s.side}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={10} style={s.iconBtn} accessibilityRole="button" accessibilityLabel="Voltar">
            <AppIcon name="ArrowLeft" size={20} color={colors.textPrimary} strokeWidth={2.4} />
          </Pressable>
        ) : null}
      </View>

      {/* Center: title + subtitle */}
      {title || subtitle ? (
        <View style={s.center}>
          {title ? <Text style={s.title} numberOfLines={1}>{title}</Text> : null}
          {subtitle ? <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      ) : (
        <View style={s.centerFlex} />
      )}

      {/* Right: avatar / notification / custom */}
      <View style={[s.side, s.sideRight]}>
        {rightAction ? (
          rightAction
        ) : showAvatar ? (
          <DAvatar size="sm" uri={avatarUri} initials={avatarInitials} />
        ) : onNotification ? (
          <Pressable onPress={onNotification} hitSlop={8} style={s.iconBtn}>
            <AppIcon name="Bell" size={20} color={colors.textPrimary} strokeWidth={2} />
            {notificationBadge && notificationBadge > 0 ? (
              <View style={s.notifBadge}>
                <Text style={s.notifBadgeText}>
                  {notificationBadge > 9 ? "9+" : notificationBadge}
                </Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  side: {
    width: 44,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  sideRight: {
    alignItems: "flex-end",
  },
  centerFlex: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  notifBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 17,
    height: 17,
    borderRadius: radius.pill,
    backgroundColor: colors.notification,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  notifBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.white,
    lineHeight: 12,
  },
});
