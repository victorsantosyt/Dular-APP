import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";

import { useDiaristaPublico } from "@/hooks/useDiaristaPublico";
import { SafeScoreBadge } from "@/components/SafeScoreBadge";
import { DAvatar } from "@/components/ui";
import { AppIcon } from "@/components/ui";
import { DButton } from "@/components/DButton";
import { colors, radius, spacing, typography } from "@/theme/tokens";
import { shadow } from "@/utils/platform";
import { formatCurrencyBRL, formatDecimalBRL } from "@/api/diaristaApi";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";
import type { ServicoOferecido } from "@/types/diarista";

type RouteProps = RouteProp<EmpregadorTabParamList, "DiaristaProfile">;
type Navigation = BottomTabNavigationProp<EmpregadorTabParamList>;

const SERVICO_LABELS: Record<ServicoOferecido, string> = {
  DIARISTA: "Diarista",
  BABA: "Babá",
  COZINHEIRA: "Cozinheira",
};

function tempoLabel(meses: number): string {
  if (meses < 12) return `${meses} ${meses === 1 ? "mês" : "meses"}`;
  const anos = Math.round(meses / 12);
  return `${anos} ${anos === 1 ? "ano" : "anos"}`;
}

function precoLinhaLabel(
  tipo: ServicoOferecido,
  precos: { leve: number | null; medio: number | null; pesada: number | null },
  extras: {
    precoBabaHora?: string | number | null;
    precoCozinheiraBase?: string | number | null;
  },
) {
  // Diarista — três intensidades agregadas como "A partir de R$X (leve), R$Y (pesada)"
  if (tipo === "DIARISTA") {
    const leveFmt = formatCurrencyBRL(precos.leve);
    const pesadaFmt = formatCurrencyBRL(precos.pesada);
    if (leveFmt && pesadaFmt) {
      return `A partir de ${leveFmt} (leve), ${pesadaFmt} (pesada)`;
    }
    if (leveFmt) return `A partir de ${leveFmt} (leve)`;
    if (pesadaFmt) return `A partir de ${pesadaFmt} (pesada)`;
    return "Sob consulta";
  }
  if (tipo === "BABA") {
    const fmt = formatDecimalBRL(extras.precoBabaHora ?? null);
    return fmt ? `${fmt}/hora` : "A combinar";
  }
  if (tipo === "COZINHEIRA") {
    const fmt = formatDecimalBRL(extras.precoCozinheiraBase ?? null);
    return fmt ? `A partir de ${fmt}` : "A combinar";
  }
  return "A combinar";
}

export function DiaristaProfileScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<RouteProps>();
  const { diaristaId, nome: nomeParam, categoriaInicial = "diarista" } = route.params;
  const insets = useSafeAreaInsets();

  const { diarista, loading, error } = useDiaristaPublico(diaristaId);

  const nome = diarista?.nome || nomeParam;
  const hasAvatar = Boolean(diarista?.avatarUrl);

  const handleContratar = () => {
    if (!diaristaId) {
      Alert.alert("Perfil inválido", "Não foi possível identificar a profissional.");
      return;
    }
    if (diarista && !diarista.perfilCompleto) {
      Alert.alert(
        "Perfil incompleto",
        "Esta profissional ainda não completou o perfil e não está disponível para contratação.",
      );
      return;
    }
    navigation.navigate("SolicitarServico", {
      categoriaInicial,
      tipoInicial: "DIARISTA",
      profissionalId: diaristaId,
      profissionalNome: nome,
    });
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

  const {
    safeScore,
    totalServicos,
    tempoPlataforma,
    verificado,
    mediaAvaliacao,
    totalAvaliacoes,
    bio,
    servicosOferecidos,
    bairros,
    cidade,
    uf,
    precos,
    atendeTodaCidade,
    precoBabaHora,
    precoCozinheiraBase,
    taxaMinima,
    cobraDeslocamento,
    valorACombinar,
    observacaoPreco,
    perfilCompleto,
  } = diarista;

  const cidadeUfText = cidade && uf ? `${cidade} • ${uf}` : null;
  const bairrosText = bairros?.length ? bairros.map((b) => b.nome).join(", ") : null;
  const servicosList = servicosOferecidos?.length ? servicosOferecidos : [];
  const taxaMinimaFmt = formatDecimalBRL(taxaMinima);

  // ── Main ───────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingTop: insets.top + 56 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Identification block */}
        <View style={s.identSection}>
          <DAvatar size="xl" uri={diarista.avatarUrl} initials={nome.slice(0, 2)} />
          <View style={s.identNameRow}>
            <Text style={s.nome}>{nome}</Text>
            {verificado ? (
              <View style={s.verifiedPill}>
                <AppIcon name="Check" size={12} color={colors.primary} strokeWidth={3} />
                <Text style={s.verifiedPillText}>Verificada</Text>
              </View>
            ) : null}
          </View>
          <SafeScoreBadge faixa={safeScore.faixa} />
          <View style={s.ratingRow}>
            <AppIcon name="Star" size={16} color={colors.warning} strokeWidth={2.5} />
            <Text style={s.ratingText}>
              {totalAvaliacoes > 0
                ? `${mediaAvaliacao.toFixed(1)} (${totalAvaliacoes} ${totalAvaliacoes === 1 ? "avaliação" : "avaliações"})`
                : "Sem avaliações ainda"}
            </Text>
          </View>
        </View>

        {/* Bio */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Sobre</Text>
          <Text style={s.bioText}>{bio || "Nenhuma bio cadastrada."}</Text>
        </View>

        {/* Serviços oferecidos */}
        {servicosList.length > 0 ? (
          <View style={s.card}>
            <Text style={s.sectionTitle}>Serviços oferecidos</Text>
            <View style={s.badgesRow}>
              {servicosList.map((sv) => (
                <View key={sv} style={s.servicoBadge}>
                  <Text style={s.servicoBadgeText}>{SERVICO_LABELS[sv] ?? sv}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Área de atendimento */}
        {(cidadeUfText || bairrosText) ? (
          <View style={s.card}>
            <Text style={s.sectionTitle}>Área de atendimento</Text>
            {cidadeUfText ? (
              <View style={s.credRow}>
                <AppIcon name="MapPin" size={16} color={colors.textSecondary} strokeWidth={2.2} />
                <Text style={s.credText}>{cidadeUfText}</Text>
              </View>
            ) : null}
            {atendeTodaCidade ? (
              <Text style={s.bairrosText}>Atende toda a cidade</Text>
            ) : bairrosText ? (
              <Text style={s.bairrosText}>{bairrosText}</Text>
            ) : null}
          </View>
        ) : null}

        {/* Preços (apenas para serviços que se aplicam) */}
        {servicosList.length > 0 ? (
          <View style={s.card}>
            <Text style={s.sectionTitle}>Preços</Text>
            {valorACombinar ? (
              <Text style={s.bairrosText}>Valor a combinar</Text>
            ) : (
              <>
                {servicosList.map((tipo) => (
                  <View key={tipo} style={s.precoRow}>
                    <Text style={s.precoLabel}>{SERVICO_LABELS[tipo] ?? tipo}</Text>
                    <Text style={s.precoValue}>
                      {precoLinhaLabel(tipo, precos, { precoBabaHora, precoCozinheiraBase })}
                    </Text>
                  </View>
                ))}
                {taxaMinimaFmt ? (
                  <View style={s.precoRow}>
                    <Text style={s.precoLabel}>Taxa mínima</Text>
                    <Text style={s.precoValue}>{taxaMinimaFmt}</Text>
                  </View>
                ) : null}
                {cobraDeslocamento ? (
                  <Text style={s.bairrosText}>Cobra deslocamento</Text>
                ) : null}
              </>
            )}
            {observacaoPreco ? (
              <Text style={s.bairrosText}>{observacaoPreco}</Text>
            ) : null}
          </View>
        ) : null}

        {/* Credenciais */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Credenciais</Text>
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
            <Text style={s.noIncidents}>Nenhum incidente registrado</Text>
          ) : (
            <Text style={s.hasIncidents}>
              {safeScore.totalIncidentes}{" "}
              {safeScore.totalIncidentes === 1 ? "ocorrência registrada" : "ocorrências registradas"}
            </Text>
          )}
        </View>

        {/* Aviso de perfil incompleto */}
        {!perfilCompleto ? (
          <View style={[s.card, s.warnCard]}>
            <View style={s.warnHeader}>
              <AppIcon name="AlertTriangle" size={16} color={colors.warning} strokeWidth={2.3} />
              <Text style={s.warnTitle}>Perfil incompleto</Text>
            </View>
            <Text style={s.warnText}>
              Esta profissional ainda está completando os dados do perfil e não está disponível
              para contratação.
            </Text>
          </View>
        ) : null}

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {/* Fixed footer */}
      <SafeAreaView edges={["bottom"]} style={[s.footer, shadow(4)]}>
        {perfilCompleto ? (
          <DButton title="Contratar" onPress={handleContratar} />
        ) : (
          <View style={s.unavailableBox}>
            <AppIcon name="AlertTriangle" size={16} color={colors.warning} strokeWidth={2.3} />
            <Text style={s.unavailableText}>
              Perfil incompleto — não disponível para contratação
            </Text>
          </View>
        )}
      </SafeAreaView>

      {/* Header overlay */}
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
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.lg,
    gap: 12,
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
    gap: 8,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  identNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  nome: {
    color: colors.textPrimary,
    ...typography.h3,
    fontWeight: "700",
    textAlign: "center",
  },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.success,
  },
  verifiedPillText: {
    color: colors.primary,
    ...typography.caption,
    fontWeight: "700",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  ratingText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: "500",
  },

  // Cards
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 10,
  },
  sectionTitle: {
    color: colors.textPrimary,
    ...typography.bodyMedium,
    fontWeight: "700",
  },
  bioText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: "500",
  },

  // Badges row (serviços oferecidos)
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  servicoBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.lavenderSoft,
    borderWidth: 1,
    borderColor: colors.lavenderStrong,
  },
  servicoBadgeText: {
    color: colors.textPrimary,
    ...typography.caption,
    fontWeight: "700",
  },

  // Área
  bairrosText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: "500",
  },

  // Preços
  precoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  precoLabel: {
    color: colors.textPrimary,
    ...typography.bodySm,
    fontWeight: "700",
  },
  precoValue: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
    marginLeft: 8,
  },

  // Credenciais
  credRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  credText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: "500",
  },

  // Safety section
  safeBadgeLarge: {
    paddingHorizontal: 16,
  },
  safeExplain: {
    ...typography.caption,
    color: colors.textMuted,
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

  // Aviso perfil incompleto
  warnCard: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  warnHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  warnTitle: {
    color: colors.warning,
    ...typography.bodyMedium,
    fontWeight: "800",
  },
  warnText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: "500",
  },

  // Footer
  footer: {
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  unavailableBox: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warning,
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  unavailableText: {
    color: colors.warning,
    ...typography.caption,
    fontWeight: "800",
    flexShrink: 1,
  },

  // Error
  errorTitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
});
