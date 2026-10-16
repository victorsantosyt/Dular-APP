import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "@/components/ui";
import type { ProfileTheme } from "@/theme/profileTheme";
import { colors, shadow, typography } from "@/theme/tokens";
import { FAMILIA_POR_PESO } from "@/theme/fonte";
import type { SafeScoreResource } from "@/hooks/useSafeScoreResource";

export function ResourceFeedback({ resource, theme, label }: {
  resource: SafeScoreResource<unknown>; theme: ProfileTheme; label: string;
}) {
  if (resource.loading) return (
    <View accessibilityRole="progressbar" accessibilityLabel={`Carregando ${label}`} style={{ padding: 24 }}>
      <ActivityIndicator color={theme.primaryDark} />
    </View>
  );
  if (!resource.error) return null;
  return <View accessibilityLiveRegion="polite" style={{ gap: 12, padding: 16 }}>
    <Text style={{ ...typography.bodySm, color: colors.ink }}>Não foi possível carregar {label}.</Text>
    <Pressable accessibilityRole="button" onPress={resource.retry} style={{ minHeight: 48, justifyContent: "center" }}>
      <Text style={{ ...typography.buttonSm, color: theme.textAccent }}>Tentar novamente</Text>
    </Pressable>
  </View>;
}

export function SafeScoreLink({ title, onPress, theme }: {
  title: string; onPress: () => void; theme: ProfileTheme;
}) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={[
    shared.link, { borderColor: theme.border },
  ]}>
    <AppIcon name="HelpCircle" color={theme.textAccent} size={22} />
    <Text style={{ ...typography.bodySmMedium, color: theme.textAccent, flex: 1 }}>{title}</Text>
    <AppIcon name="ChevronRight" color={theme.textAccent} size={18} />
  </Pressable>;
}

const shared = StyleSheet.create({
  link: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 8 },
});

export function makeSafeScoreStyles(theme: ProfileTheme) {
  return StyleSheet.create({
    content: { gap: 8, paddingTop: 4 },
    card: { borderWidth: 1, borderColor: `${theme.border}66`, borderRadius: 18, padding: 16, backgroundColor: colors.card,
      // Sombra mais leve que a do app, só nesta tela (referência aprovada).
      ...shadow.soft, shadowColor: theme.primaryDark, shadowOpacity: 0.02, shadowRadius: 8, elevation: 1 },
    eyebrow: { ...typography.caption, color: colors.sub, letterSpacing: 1, textTransform: "uppercase", marginBottom: -8 },
    hero: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 146, paddingVertical: 0, paddingLeft: 20, paddingRight: 12 },
    heroStacked: { flexDirection: "column", alignItems: "stretch" },
    heroCopy: { flex: 1, gap: 12 },
    heroTitle: { ...typography.h2, color: colors.ink, fontWeight: "800" },
    heroArt: { alignItems: "center", justifyContent: "center", flexShrink: 0 },
    heroStatus: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 8,
      borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, maxWidth: "100%" },
    statusDot: { width: 9, height: 9, borderRadius: 5 },
    // Família Bold explícita e sem fontWeight: com os dois, o Android mede o
    // texto com outra largura e, com fonte ampliada, reserva uma segunda linha
    // vazia (a pílula cresce e o ponto desce).
    statusText: { fontSize: typography.bodySmMedium.fontSize, lineHeight: typography.bodySmMedium.lineHeight,
      fontFamily: FAMILIA_POR_PESO["700"], color: colors.ink, flexShrink: 1 },
    caption: { ...typography.bodySm, color: colors.sub, textAlign: "center", paddingHorizontal: 4 },
    section: { ...typography.h3, fontWeight: "700", color: colors.ink, marginTop: 4 },
    sectionRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
    sectionHeading: { ...typography.h3, fontWeight: "700", color: colors.ink, flex: 1 },
    infoButton: { minWidth: 32, minHeight: 28, alignItems: "flex-end", justifyContent: "center" },
    details: { paddingHorizontal: 16, paddingVertical: 2 },
    row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 72, paddingVertical: 12 },
    divider: { borderBottomWidth: 1, borderBottomColor: `${theme.border}44` },
    icon: { width: 46, height: 46, borderRadius: 14, backgroundColor: theme.primarySoft, alignItems: "center", justifyContent: "center" },
    rowContent: { flex: 1, gap: 4, minWidth: 0 },
    rowTitle: { ...typography.bodyMedium, fontWeight: "700", color: colors.ink },
    rowDescription: { ...typography.bodySm, color: colors.sub },
    rowValue: { flexShrink: 1, maxWidth: "34%", alignItems: "flex-end", justifyContent: "center" },
    tierValue: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" },
    value: { ...typography.bodyMedium, fontWeight: "700", color: colors.ink, textAlign: "right", flexShrink: 1 },
    // Sem cálculo: texto discreto e estreito (duas linhas curtas), sem
    // espremer o subtítulo da linha.
    valuePending: { ...typography.bodySm, fontWeight: "600", color: colors.sub, textAlign: "right", maxWidth: 88 },
    identityBadge: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14 },
    identityValue: { ...typography.bodySmMedium, fontWeight: "600", textAlign: "right" },
    identityAction: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: theme.primarySoft, minHeight: 72, paddingVertical: 10 },
    identityTitle: { ...typography.bodyMedium, color: theme.textAccent, fontWeight: "700" },
    body: { ...typography.bodySm, color: colors.sub },
    empty: { alignItems: "center", gap: 6, paddingVertical: 12, minHeight: 146 },
    emptyIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: theme.primarySoft, alignItems: "center", justifyContent: "center", marginBottom: 0 },
    emptyTitle: { ...typography.bodyMedium, fontWeight: "700", color: colors.ink, textAlign: "center" },
    emptyDescription: { ...typography.bodySm, color: colors.sub, textAlign: "center", maxWidth: 310 },
    sosItem: { gap: 8, paddingVertical: 12 },
    badge: { ...typography.caption, color: theme.textAccent, backgroundColor: theme.primarySoft, borderRadius: 12, padding: 8, alignSelf: "flex-start" },
  });
}
