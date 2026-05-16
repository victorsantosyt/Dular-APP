import React, { ReactNode, useMemo } from "react";
import { Image, ImageSourcePropType, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { DCard } from "@/components/ui/DCard";
import { useDularColors } from "@/hooks/useDularColors";
import { radius, shadows, spacing, typography } from "@/theme";

type ThemeColors = ReturnType<typeof useDularColors>;

type NotificationBellProps = {
  hasBadge?: boolean;
  onPress: () => void;
};

export function NotificationBell({ hasBadge, onPress }: NotificationBellProps) {
  const colors = useDularColors();
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.notificationButton, pressed && { opacity: 0.78 }]}>
      <AppIcon name="Bell" size={21} color={colors.textSecondary} strokeWidth={2.2} />
      {hasBadge ? <View style={s.notificationDot} /> : null}
    </Pressable>
  );
}

type ProfileHeroCardProps = {
  nome: string;
  subtitle: string;
  location: string;
  memberSince: string;
  avatarUri?: string | null;
  avatarFallback: ImageSourcePropType | null;
  uploading?: boolean;
  onAvatarPress: () => void;
  /** Override do gradient do hero. Default: roxo do tema (Empregador). */
  gradient?: readonly [string, string];
  /** Cor do ícone Check + texto da pílula "Verificado" e ícone do avatar
   *  fallback. Default: `colors.primary` (roxo). */
  accentColor?: string;
  /** Texto do prefixo da data — algumas identidades preferem "Usuário desde"
   *  no masculino. Default: "Usuária desde". */
  memberSincePrefix?: string;
};

export function ProfileHeroCard({
  nome,
  subtitle,
  location,
  memberSince,
  avatarUri,
  avatarFallback,
  uploading,
  onAvatarPress,
  gradient,
  accentColor,
  memberSincePrefix = "Usuária desde",
}: ProfileHeroCardProps) {
  const colors = useDularColors();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const heroGradient = gradient ?? [colors.primary, colors.primaryLight];
  const accent = accentColor ?? colors.primary;
  return (
    <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
      <View style={s.heroGhost}>
        <AppIcon name="Home" size={150} color={colors.whiteAlpha20} strokeWidth={1.2} />
      </View>
      <View style={s.avatarColumn}>
        <Pressable onPress={onAvatarPress} style={s.avatarWrap}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={s.avatarImg} />
          ) : avatarFallback ? (
            <Image source={avatarFallback} style={s.avatarImg} />
          ) : (
            <View style={s.avatarFallback}>
              <AppIcon name="User" size={42} color={accent} />
            </View>
          )}
          <View style={s.cameraBadge}>
            {uploading ? (
              <AppIcon name="Clock" size={13} color={colors.white} />
            ) : (
              <AppIcon name="Camera" size={13} color={colors.white} />
            )}
          </View>
        </Pressable>
      </View>

      <View style={s.heroInfo}>
        <View style={s.nameRow}>
          <Text style={s.heroName} numberOfLines={1}>
            {nome}
          </Text>
          <View style={s.verifiedPill}>
            <AppIcon name="Check" size={12} color={accent} strokeWidth={3} />
            <Text style={[s.verifiedText, { color: accent }]}>Verificado</Text>
          </View>
        </View>
        <Text style={s.heroSubtitle}>{subtitle}</Text>
        <View style={s.heroDivider} />
        <View style={s.infoLine}>
          <AppIcon name="MapPin" size={15} color={colors.whiteAlpha90} strokeWidth={2.2} />
          <Text style={s.infoLineText}>{location}</Text>
        </View>
        <View style={s.infoLine}>
          <AppIcon name="Calendar" size={15} color={colors.whiteAlpha90} strokeWidth={2.2} />
          <Text style={s.infoLineText}>{memberSincePrefix} {memberSince}</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

type ProfileSectionProps = {
  title: string;
  children: ReactNode;
};

export function ProfileSection({ title, children }: ProfileSectionProps) {
  const colors = useDularColors();
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={s.sectionWrap}>
      <Text style={s.sectionTitle}>{title}</Text>
      <DCard style={s.sectionCard}>{children}</DCard>
    </View>
  );
}

type ProfileRowProps = {
  icon: AppIconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  danger?: boolean;
  isLast?: boolean;
  /** Cor do ícone à esquerda. Default: `colors.primary` (roxo). */
  accentColor?: string;
  /** Cor de fundo do quadrado do ícone à esquerda. Default: `colors.lavenderSoft`. */
  accentSoft?: string;
};

export function ProfileRow({
  icon,
  title,
  subtitle,
  onPress,
  danger,
  isLast,
  accentColor,
  accentSoft,
}: ProfileRowProps) {
  const colors = useDularColors();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const accent = accentColor ?? colors.primary;
  const accentBg = accentSoft ?? colors.lavenderSoft;
  const tone = danger ? colors.danger : accent;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.row, !isLast && s.rowDivider, pressed && { opacity: 0.74 }]}>
      <View
        style={[
          s.rowIcon,
          { backgroundColor: accentBg },
          danger && s.rowIconDanger,
        ]}
      >
        <AppIcon name={icon} size={20} color={tone} strokeWidth={2.2} />
      </View>
      <View style={s.rowText}>
        <Text style={[s.rowTitle, danger && s.rowTitleDanger]}>{title}</Text>
        <Text style={s.rowSubtitle}>{subtitle}</Text>
      </View>
      <ProfileChevron danger={danger} />
    </Pressable>
  );
}

type ProfileSwitchRowProps = {
  icon: AppIconName;
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  isLast?: boolean;
  /** Cor do ícone, do thumb e da track (estado ativo). Default: `colors.primary`. */
  accentColor?: string;
  /** Cor mais clara usada no track ativo. Default: `colors.primaryLight`. */
  accentLight?: string;
  /** Background do quadrado do ícone à esquerda. Default: `colors.lavenderSoft`. */
  accentSoft?: string;
};

export function ProfileSwitchRow({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
  isLast,
  accentColor,
  accentLight,
  accentSoft,
}: ProfileSwitchRowProps) {
  const colors = useDularColors();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const accent = accentColor ?? colors.primary;
  const accentLightFinal = accentLight ?? colors.primaryLight;
  const accentBg = accentSoft ?? colors.lavenderSoft;
  return (
    <View style={[s.row, !isLast && s.rowDivider]}>
      <View style={[s.rowIcon, { backgroundColor: accentBg }]}>
        <AppIcon name={icon} size={20} color={accent} strokeWidth={2.2} />
      </View>
      <View style={s.rowText}>
        <Text style={s.rowTitle}>{title}</Text>
        <Text style={s.rowSubtitle}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.lavenderStrong, true: accentLightFinal }}
        thumbColor={value ? accent : colors.white}
        ios_backgroundColor={colors.lavenderStrong}
      />
    </View>
  );
}

export function ProfileChevron({ danger }: { danger?: boolean }) {
  const colors = useDularColors();
  return <AppIcon name="ChevronRight" size={18} color={danger ? colors.danger : colors.textMuted} strokeWidth={2.2} />;
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    notificationButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.soft,
    },
    notificationDot: {
      position: "absolute",
      top: 11,
      right: 12,
      width: 9,
      height: 9,
      borderRadius: 5,
      borderWidth: 2,
      borderColor: colors.surface,
      backgroundColor: colors.notification,
    },
    hero: {
      minHeight: 160,
      borderRadius: radius.lg,
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      overflow: "hidden",
      ...shadows.primaryButton,
    },
    heroGhost: {
      position: "absolute",
      right: -28,
      bottom: -30,
      opacity: 0.4,
    },
    avatarColumn: {
      alignItems: "center",
      justifyContent: "center",
    },
    avatarWrap: {
      width: 74,
      height: 74,
      borderRadius: 37,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.white,
      borderWidth: 4,
      borderColor: colors.whiteAlpha70,
      position: "relative",
    },
    avatarImg: {
      width: 68,
      height: 68,
      borderRadius: 34,
    },
    avatarFallback: {
      width: 68,
      height: 68,
      borderRadius: 34,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.lavenderSoft,
    },
    cameraBadge: {
      position: "absolute",
      right: -1,
      bottom: 2,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.pink,
      borderWidth: 3,
      borderColor: colors.white,
    },
    heroInfo: {
      flex: 1,
      minWidth: 0,
      gap: 5,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    heroName: {
      flex: 1,
      color: colors.white,
      ...typography.h3,

      fontWeight: "700",
      letterSpacing: 0,
    },
    verifiedPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: colors.whiteAlpha90,
    },
    verifiedText: {
      color: colors.primary,
      ...typography.caption,
      fontWeight: "700",
    },
    heroSubtitle: {
      color: colors.whiteAlpha90,
      ...typography.bodySm,
      fontWeight: "500",
    },
    heroDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.whiteAlpha20,
      marginVertical: 4,
    },
    infoLine: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },
    infoLineText: {
      flex: 1,
      color: colors.whiteAlpha90,
      ...typography.caption,
      fontWeight: "500",
    },
    sectionWrap: {
      gap: spacing.sm,
    },
    sectionTitle: {
      color: colors.textPrimary,
      ...typography.bodyMedium,
      fontWeight: "700",
      paddingHorizontal: 2,
    },
    sectionCard: {
      padding: 0,
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: colors.surface,
    },
    row: {
      minHeight: 60,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.surface,
    },
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.lavenderSoft,
    },
    rowIconDanger: {
      backgroundColor: colors.dangerSoft,
    },
    rowText: {
      flex: 1,
      gap: 4,
    },
    rowTitle: {
      color: colors.textPrimary,
      ...typography.bodySm,
      fontWeight: "700",
    },
    rowTitleDanger: {
      color: colors.danger,
    },
    rowSubtitle: {
      color: colors.textSecondary,
      ...typography.caption,

      fontWeight: "500",
    },
  });
}
