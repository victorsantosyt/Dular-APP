import React, { ReactElement } from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { colors, radius, shadows, spacing, typography } from "@/theme";

type Tone = "purple" | "pink" | "green" | "red" | "yellow" | "blue";

type Props = {
  icon: AppIconName | ReactElement;
  title: string;
  description: string;
  color?: Tone;
  onPress?: () => void;
  selected?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

const TONE: Record<Tone, { fg: string; bg: string; border: string }> = {
  purple: { fg: colors.primary, bg: colors.purpleSoft, border: colors.primary },
  pink: { fg: colors.pink, bg: colors.pinkSoft, border: colors.pink },
  green: { fg: colors.success, bg: colors.greenSoft, border: colors.success },
  red: { fg: colors.danger, bg: colors.redSoft, border: colors.danger },
  yellow: { fg: colors.warning, bg: colors.yellowSoft, border: colors.warning },
  blue: { fg: colors.info, bg: colors.blueSoft, border: colors.info },
};

export function IconCard({
  icon,
  title,
  description,
  color = "purple",
  onPress,
  selected,
  disabled,
  style,
}: Props) {
  const tone = TONE[color];
  const content = (
    <View style={[styles.card, selected && { borderColor: tone.border }, disabled && styles.disabled, style]}>
      <View style={[styles.iconBubble, { backgroundColor: tone.bg }]}>
        {typeof icon === "string" ? (
          <AppIcon name={icon} color={tone.fg} size={22} />
        ) : (
          icon
        )}
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
    ...shadows.card,
  },
  iconBubble: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: {
    flex: 1,
  },
  title: {
    ...typography.h4,
    color: colors.textPrimary,
  },
  description: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.55,
  },
});
