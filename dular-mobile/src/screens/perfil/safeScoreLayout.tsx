import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "@/components/ui";
import type { ProfileTheme } from "@/theme/profileTheme";
import { colors, shadow, typography } from "@/theme/tokens";
import type { SafeScoreResource } from "@/hooks/useSafeScoreResource";

export function ResourceFeedback({ resource, theme, label }: { resource: SafeScoreResource<unknown>; theme: ProfileTheme; label: string }) {
  if (resource.loading) return <View accessibilityRole="progressbar" accessibilityLabel={`Carregando ${label}`} style={{ padding: 24 }}><ActivityIndicator color={theme.primaryDark} /></View>;
  if (!resource.error) return null;
  return <View accessibilityLiveRegion="polite" style={{ gap: 12, padding: 16 }}>
    <Text style={{ ...typography.bodySm, color: colors.ink }}>Não foi possível carregar {label}.</Text>
    <Pressable accessibilityRole="button" onPress={resource.retry} style={{ minHeight: 48, justifyContent: "center" }}>
      <Text style={{ ...typography.buttonSm, color: theme.textAccent }}>Tentar novamente</Text>
    </Pressable>
  </View>;
}

export function SafeScoreLink({ title, onPress, theme }: { title: string; onPress: () => void; theme: ProfileTheme }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}>
    <Text style={{ ...typography.buttonSm, color: theme.textAccent, flex: 1 }}>{title}</Text>
    <AppIcon name="ChevronRight" color={theme.textAccent} size={20} />
  </Pressable>;
}

export function makeSafeScoreStyles(theme: ProfileTheme) {
  return StyleSheet.create({
    card: { borderWidth: 1, borderColor: theme.border, borderRadius: 20, padding: 20, gap: 12, backgroundColor: colors.card, ...shadow.card },
    hero: { alignItems: "center", backgroundColor: theme.primarySoft, paddingVertical: 28 },
    shield: { width: 104, height: 112, borderRadius: 32, borderWidth: 1, borderColor: theme.border, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", ...shadow.soft },
    title: { ...typography.h3, color: colors.ink, textAlign: "center" },
    body: { ...typography.bodySm, color: colors.sub },
    center: { textAlign: "center" },
    section: { ...typography.title, color: colors.ink, marginTop: 8 },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
    divider: { borderBottomWidth: 1, borderBottomColor: theme.border },
    icon: { width: 40, height: 40, borderRadius: 14, backgroundColor: theme.primarySoft, alignItems: "center", justifyContent: "center" },
    rowContent: { flex: 1, gap: 4 },
    label: { ...typography.bodySm, color: colors.sub },
    value: { ...typography.bodyMedium, fontWeight: "700", color: colors.ink },
    badge: { ...typography.caption, color: theme.textAccent, backgroundColor: theme.primarySoft, borderRadius: 12, padding: 8, alignSelf: "flex-start" },
    warning: { color: colors.warning },
  });
}
