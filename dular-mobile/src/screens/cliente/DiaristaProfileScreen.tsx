import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";

import { useDiaristaPublico } from "@/hooks/useDiaristaPublico";
import { SafeScoreBadge } from "@/components/SafeScoreBadge";
import { DAvatar } from "@/components/ui";
import { AppIcon } from "@/components/ui";
import { DButton } from "@/components/DButton";
import { colors, radius, spacing, typography } from "@/theme/tokens";
import { shadow } from "@/utils/platform";
import type { ClienteTabParamList } from "@/navigation/ClienteNavigator";

type RouteProps = RouteProp<ClienteTabParamList, "DiaristaProfile">;

function tempoLabel(meses: number): string {
  if (meses < 12) return `${meses} ${meses === 1 ? "mês" : "meses"}`;
  const anos = Math.round(meses / 12);
  return `${anos} ${anos === 1 ? "ano" : "anos"}`;
}

export function DiaristaProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { diaristaId, nome: nomeParam } = route.params;
  const insets = useSafeAreaInsets();

  const { diarista, loading, error } = useDiaristaPublico(diaristaId);

  const nome = diarista?.nome || nomeParam;
  const hasAvatar = Boolean(diarista?.avatarUrl);

  const handleContratar = () => {
    Alert.alert("Em breve", "Fluxo de contratação em breve!");
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.root}>
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
        <View style={[s.headerOverlay, { paddingTop: insets.top }]} pointerEvents="box-none">
          <View style={s.headerContent} pointerEvents="box-none">
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={12}
              style={s.backBtn}
              pointerEvents="auto"
            >
              <AppIcon name="ArrowLeft" size={22} color={colors.primary} strokeWidth={2.5} />
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !diarista) {
    return (
      <View style={s.root}>
        <View style={s.center}>
          <Text style={s.errorTitle}>Não foi possível carregar o perfil.</Text>
          <DButton
            title="Voltar"
            variant="outline"
            onPress={() => navigation.goBack()}
            style={{ marginTop: spacing.md }}
          />
        </View>
        <View style={[s.headerOverlay, { paddingTop: insets.top }]} pointerEvents="box-none">
          <View style={s.headerContent} pointerEvents="box-none">
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={12}
              style={s.backBtn}
              pointerEvents="auto"
            >
              <AppIcon name="ArrowLeft" size={22} color={colors.primary} strokeWidth={2.5} />
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  const { safeScore, totalServicos, tempoPlataforma, verificado, mediaAvaliacao, totalAvaliacoes, bio } = diarista;

  // ── Main ───────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      {/* Scrollable content */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingTop: insets.top + 56 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Identification block */}
        <View style={s.identSection}>
          <DAvatar
            size="xl"
            uri={diarista.avatarUrl}
            initials={nome.slice(0, 2)}
          />
          <Text style={s.nome}>{nome}</Text>
          <SafeScoreBadge faixa={safeScore.faixa} />
          <View style={s.ratingRow}>
            <AppIcon name="Star" size={16} color={colors.warning} strokeWidth={2.5} />
            <Text style={s.ratingText}>
              {totalAvaliacoes > 0
                ? `${mediaAvaliacao.toFixed(1)} (${totalAvaliacoes} avaliações)`
                : "Sem avaliações ainda"}
            </Text>
          </View>
        </View>

        {/* Sobre */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Sobre</Text>
          <Text style={s.bioText}>
            {bio || "Nenhuma bio cadastrada."}
          </Text>
        </View>

        {/* Credenciais */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Credenciais</Text>
          {verificado ? (
            <View style={s.credRow}>
              <AppIcon name="Check" size={16} color={colors.success} strokeWidth={2.5} />
              <Text style={[s.credText, { color: colors.success }]}>Verificada</Text>
            </View>
          ) : null}
          <View style={s.credRow}>
            <AppIcon name="Award" size={16} color={colors.textSecondary} strokeWidth={2.2} />
            <Text style={s.credText}>
              {totalServicos} {totalServicos === 1 ? "serviço realizado" : "serviços realizados"}
            </Text>
          </View>
          <View style={s.credRow}>
            <AppIcon name="Clock" size={16} color={colors.textSecondary} strokeWidth={2.2} />
            <Text style={s.credText}>{tempoLabel(tempoPlataforma)} na plataforma</Text>
          </View>
        </View>

        {/* Segurança */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Segurança</Text>
          <SafeScoreBadge faixa={safeScore.faixa} style={s.safeBadgeLarge} />
          <Text style={s.safeExplain}>
            O SafeScore indica o histórico de comportamento desta profissional na plataforma.
          </Text>
          {safeScore.totalIncidentes === 0 ? (
            <Text style={s.noIncidents}>Nenhum incidente registrado ✓</Text>
          ) : (
            <Text style={s.hasIncidents}>
              {safeScore.totalIncidentes}{" "}
              {safeScore.totalIncidentes === 1 ? "ocorrência registrada" : "ocorrências registradas"}
            </Text>
          )}
        </View>

        {/* Bottom spacing for footer */}
        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {/* Fixed footer */}
      <SafeAreaView edges={["bottom"]} style={[s.footer, shadow(4)]}>
        <DButton title="Contratar" onPress={handleContratar} />
      </SafeAreaView>

      {/* Absolute transparent header */}
      <View style={[s.headerOverlay, { paddingTop: insets.top }]} pointerEvents="box-none">
        <View style={s.headerContent} pointerEvents="box-none">
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={s.backBtn}
            pointerEvents="auto"
          >
            <AppIcon
              name="ArrowLeft"
              size={22}
              color={hasAvatar ? colors.white : colors.primary}
              strokeWidth={2.5}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default DiaristaProfileScreen;

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },

  // Header overlay
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    height: 56,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.glassLight,
  },

  // Identification section
  identSection: {
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  nome: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: "center",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  ratingText: {
    ...typography.body,
    color: colors.textSecondary,
  },

  // Cards
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  bioText: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },

  // Credenciais
  credRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  credText: {
    ...typography.body,
    color: colors.textSecondary,
  },

  // Safety section
  safeBadgeLarge: {
    paddingHorizontal: 16,
  },
  safeExplain: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
  noIncidents: {
    ...typography.caption,
    color: colors.success,
    fontWeight: "700",
  },
  hasIncidents: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: "700",
  },

  // Footer
  footer: {
    backgroundColor: colors.surface,
    padding: spacing.md,
  },

  // Error
  errorTitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
});
