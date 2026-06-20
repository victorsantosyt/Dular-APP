/**
 * PerfilPublicoLayout — layout ÚNICO da tela "Ver Perfil" que o empregador abre
 * ao tocar num card de profissional (Montador, Diarista, …).
 *
 * Existe UMA estrutura/layout para TODOS os cards — preenchida com os dados do
 * profissional escolhido. Tanto MontadorPublicProfile quanto DiaristaProfileScreen
 * renderizam este componente; não há mais telas de perfil com estruturas
 * diferentes. Tema sempre EMPREGADOR (roxo lavanda).
 *
 * Apresentacional/puro: recebe `hero` + `sections` já normalizados pela tela.
 */
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppIcon } from "@/components/ui";
import { useDularColors } from "@/hooks/useDularColors";
import { getProfileTheme } from "@/theme/profileTheme";
import { DAvatar } from "@/components/ui";
import { radius, shadows, spacing, typography } from "@/theme";

export type PerfilHeroData = {
  avatarUrl?: string | null;
  nome: string;
  /** Papel exibido sob o nome (ex.: "Montador profissional"). */
  papel: string;
  rating?: number;
  verificado?: boolean;
  /** Linha de localização (ex.: "Água Boa · MT"). */
  locationLine?: string | null;
};

export type PerfilSection =
  | { key: string; kind: "text"; label: string; text?: string | null; empty?: string }
  | { key: string; kind: "chips"; label: string; items: string[]; lead?: string | null; empty?: string }
  | {
      key: string;
      kind: "infoGrid";
      cells: Array<{ label: string; value: string; hint?: string | null }>;
    }
  | { key: string; kind: "stats"; stats: Array<{ value: string; label: string }> }
  | { key: string; kind: "custom"; render: () => React.ReactNode };

type Props = {
  title: string;
  onBack: () => void;
  favorito?: boolean;
  onToggleFavorito?: () => void;
  hero: PerfilHeroData;
  sections: PerfilSection[];
  /** Conteúdo fixo no rodapé (ex.: botão Contratar/Acompanhar). */
  footer?: React.ReactNode;
  error?: string | null;
};

export function PerfilPublicoLayout({
  title,
  onBack,
  favorito,
  onToggleFavorito,
  hero,
  sections,
  footer,
  error,
}: Props) {
  const colors = useDularColors();
  const theme = React.useMemo(() => getProfileTheme({ role: "EMPREGADOR" }), []);
  const s = React.useMemo(() => makeStyles({ theme, colors }), [theme, colors]);

  const showFav = typeof onToggleFavorito === "function";
  const initials = hero.nome.slice(0, 2).toUpperCase();

  return (
    <SafeAreaView style={s.root} edges={["top", "left", "right"]}>
      <View style={s.header}>
        <Pressable
          onPress={onBack}
          hitSlop={12}
          style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}
        >
          <AppIcon name="ArrowLeft" size={20} color={theme.primary} strokeWidth={2.5} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
        {showFav ? (
          <Pressable
            onPress={onToggleFavorito}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={favorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}
          >
            <AppIcon
              name="Heart"
              size={20}
              color={favorito ? colors.danger : colors.textMuted}
              strokeWidth={favorito ? 2.6 : 2.2}
            />
          </Pressable>
        ) : (
          <View style={s.headerSpacer} />
        )}
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {error ? (
          <View style={s.errorCard}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Hero */}
        <View style={s.hero}>
          <DAvatar uri={hero.avatarUrl ?? undefined} size="xl" initials={initials} />
          <View style={s.heroText}>
            <Text style={s.name} numberOfLines={1}>{hero.nome}</Text>
            <Text style={s.role}>{hero.papel}</Text>
            <View style={s.heroBadges}>
              <View style={[s.badge, { backgroundColor: theme.primarySoft }]}>
                <AppIcon name="Star" size={12} color={theme.primary} strokeWidth={2.5} />
                <Text style={[s.badgeText, { color: theme.primary }]}>
                  {hero.rating && hero.rating > 0 ? hero.rating.toFixed(1) : "Sem avaliações"}
                </Text>
              </View>
              <View
                style={[
                  s.badge,
                  { backgroundColor: hero.verificado ? theme.primarySoft : colors.warningSoft },
                ]}
              >
                <Text
                  style={[
                    s.badgeText,
                    { color: hero.verificado ? theme.primary : colors.warningDark },
                  ]}
                >
                  {hero.verificado ? "Verificado" : "Verificação pendente"}
                </Text>
              </View>
            </View>
            {hero.locationLine ? <Text style={s.locationLine}>{hero.locationLine}</Text> : null}
          </View>
        </View>

        {sections.map((section) => (
          <SectionView key={section.key} section={section} s={s} theme={theme} />
        ))}
      </ScrollView>

      {footer ? <View style={s.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export default PerfilPublicoLayout;

function SectionView({
  section,
  s,
  theme,
}: {
  section: PerfilSection;
  s: ReturnType<typeof makeStyles>;
  theme: ReturnType<typeof getProfileTheme>;
}) {
  if (section.kind === "text") {
    return (
      <View style={s.card}>
        <Text style={s.cardLabel}>{section.label}</Text>
        {section.text ? (
          <Text style={s.bio}>{section.text}</Text>
        ) : (
          <Text style={s.empty}>{section.empty ?? "Não informado."}</Text>
        )}
      </View>
    );
  }

  if (section.kind === "chips") {
    return (
      <View style={s.card}>
        <Text style={s.cardLabel}>{section.label}</Text>
        {section.lead ? <Text style={s.bio}>{section.lead}</Text> : null}
        {section.items.length > 0 ? (
          <View style={s.chips}>
            {section.items.map((item, idx) => (
              <View key={`${item}-${idx}`} style={[s.chip, { backgroundColor: theme.primarySoft }]}>
                <Text style={[s.chipText, { color: theme.textAccent }]}>{item}</Text>
              </View>
            ))}
          </View>
        ) : !section.lead ? (
          <Text style={s.empty}>{section.empty ?? "Não informado."}</Text>
        ) : null}
      </View>
    );
  }

  if (section.kind === "infoGrid") {
    return (
      <View style={s.infoGrid}>
        {section.cells.map((cell, idx) => (
          <React.Fragment key={cell.label}>
            {idx > 0 ? <View style={s.statDivider} /> : null}
            <View style={s.infoCell}>
              <Text style={s.cardLabel}>{cell.label}</Text>
              <Text style={[s.infoValue, { color: theme.textAccent }]}>{cell.value}</Text>
              {cell.hint ? <Text style={s.infoHint}>{cell.hint}</Text> : null}
            </View>
          </React.Fragment>
        ))}
      </View>
    );
  }

  if (section.kind === "stats") {
    return (
      <View style={s.statsRow}>
        {section.stats.map((stat, idx) => (
          <React.Fragment key={stat.label}>
            {idx > 0 ? <View style={s.statDivider} /> : null}
            <View style={s.statCell}>
              <Text style={[s.statValue, { color: theme.textAccent }]}>{stat.value}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>
    );
  }

  // custom
  return <>{section.render()}</>;
}

function makeStyles({
  theme,
  colors,
}: {
  theme: ReturnType<typeof getProfileTheme>;
  colors: ReturnType<typeof useDularColors>;
}) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.screenPadding,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerTitle: {
      flex: 1,
      textAlign: "center",
      ...typography.bodyMedium,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    headerSpacer: { width: 40 },
    scroll: {
      paddingHorizontal: spacing.screenPadding,
      paddingTop: 8,
      paddingBottom: 32,
      gap: 14,
    },
    errorCard: {
      borderRadius: radius.lg,
      padding: 12,
      backgroundColor: "rgba(255, 90, 110, 0.08)",
    },
    errorText: { color: "#FF5A6E", ...typography.bodySm, fontWeight: "600" },
    hero: {
      flexDirection: "row",
      gap: 14,
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      ...shadows.card,
    },
    heroText: { flex: 1, gap: 6 },
    name: { ...typography.title, color: colors.textPrimary, fontWeight: "800" },
    role: { ...typography.bodySm, color: colors.textSecondary, fontWeight: "700" },
    heroBadges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: radius.pill,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    badgeText: { fontSize: 11, fontWeight: "900" },
    locationLine: { ...typography.caption, color: colors.textMuted, fontWeight: "700" },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      gap: 10,
      ...shadows.soft,
    },
    cardLabel: {
      ...typography.caption,
      color: colors.textMuted,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    bio: { ...typography.bodySm, color: colors.textPrimary, lineHeight: 20, fontWeight: "500" },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    chipText: { fontSize: 12, fontWeight: "800" },
    empty: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "500",
      fontStyle: "italic",
    },
    infoGrid: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 14,
      ...shadows.soft,
    },
    infoCell: { flex: 1, gap: 6, paddingHorizontal: 14 },
    infoValue: { ...typography.bodySmMedium, fontWeight: "900" },
    infoHint: { ...typography.caption, color: colors.textSecondary, fontWeight: "500" },
    statsRow: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 14,
    },
    statCell: { flex: 1, alignItems: "center", gap: 4 },
    statDivider: { width: StyleSheet.hairlineWidth, marginVertical: 4, backgroundColor: theme.border },
    statValue: { ...typography.h2, fontWeight: "800" },
    statLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: "700" },
    footer: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xl,
      backgroundColor: theme.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
  });
}
