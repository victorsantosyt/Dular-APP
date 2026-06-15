import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";

import { AppIcon, BackCircleButton, DEmptyState, DErrorState, DLoadingState, DScreen } from "@/components/ui";
import { useMontadorServicos } from "@/hooks/useMontadorServicos";
import { useProfileTheme } from "@/hooks/useProfileTheme";
import type { MontadorServico } from "@/api/montadorApi";
import type { MontadorTabParamList } from "@/navigation/MontadorNavigator";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import { formatMoneyFromCents, labelServico, upperStatus } from "./montadorUtils";

type Navigation = BottomTabNavigationProp<MontadorTabParamList>;

const CONCLUIDO = new Set(["FINALIZADO", "CONCLUIDO"]);
const EM_ANDAMENTO = new Set(["ACEITO", "CONFIRMADO", "EM_ANDAMENTO", "AGUARDANDO_FINALIZACAO"]);

/** Valor monetário de um serviço (em centavos): preço final fechado ou estimado. */
function valorServico(servico: MontadorServico) {
  return servico.precoFinal ?? servico.valorEstimado ?? 0;
}

function isCurrentMonth(data?: string | Date | null) {
  if (!data) return false;
  const date = new Date(data);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function formatDataServico(data?: string | Date | null) {
  if (!data) return "Data a combinar";
  const date = new Date(data);
  if (Number.isNaN(date.getTime())) return "Data a combinar";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function dataMs(data?: string | Date | null) {
  if (!data) return 0;
  const date = new Date(data);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

type Badge = { label: string; color: string; soft: string };

function statusBadge(status: unknown): Badge {
  const s = upperStatus(status);
  if (CONCLUIDO.has(s)) return { label: "Concluído", color: colors.success, soft: colors.successSoft };
  if (s === "EM_ANDAMENTO") return { label: "Em andamento", color: colors.warning, soft: colors.warningSoft };
  if (s === "AGUARDANDO_FINALIZACAO")
    return { label: "Aguardando", color: colors.warning, soft: colors.warningSoft };
  return { label: "Agendado", color: colors.textSecondary, soft: colors.background };
}

/**
 * CarteiraScreen — acompanhamento financeiro do montador.
 *
 * Não é uma carteira transacional: não movimenta valores nem guarda saldo. É só
 * uma tela de monitoramento — consolida o histórico de serviços e os ganhos
 * (totais, do mês, ticket médio e a receber) calculados a partir dos serviços
 * retornados por useMontadorServicos. Acessível pela home (ícone da carteira) e
 * pelo perfil (linha "Carteira/Ganhos").
 */
export default function CarteiraScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute();
  const theme = useProfileTheme("MONTADOR");
  const { servicos, loading, error, refetch, refreshing } = useMontadorServicos();

  const from = (route.params as { from?: keyof MontadorTabParamList } | undefined)?.from;
  const voltar = () => navigation.navigate((from ?? "MontadorPerfil") as never);

  const resumo = useMemo(() => {
    const concluidos = servicos.filter((s) => CONCLUIDO.has(upperStatus(s.status)));
    const pendentesReceber = servicos.filter((s) => EM_ANDAMENTO.has(upperStatus(s.status)));
    const ganhosTotais = concluidos.reduce((sum, s) => sum + valorServico(s), 0);
    const ganhosMes = concluidos
      .filter((s) => isCurrentMonth(s.data))
      .reduce((sum, s) => sum + valorServico(s), 0);
    const ticketMedio = concluidos.length ? Math.round(ganhosTotais / concluidos.length) : 0;
    const aReceber = pendentesReceber.reduce((sum, s) => sum + valorServico(s), 0);
    const historico = [...concluidos, ...pendentesReceber].sort((a, b) => dataMs(b.data) - dataMs(a.data));
    return { concluidos, ganhosTotais, ganhosMes, ticketMedio, aReceber, historico };
  }, [servicos]);

  const metric = (label: string, value: string, hint?: string) => (
    <View style={[styles.metric, { borderColor: theme.border }]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {hint ? <Text style={styles.metricHint}>{hint}</Text> : null}
    </View>
  );

  return (
    <DScreen
      scroll
      withBottomPadding
      backgroundColor={theme.background}
      contentContainerStyle={styles.scroll}
      refreshing={refreshing}
      onRefresh={refetch}
      refreshTintColor={theme.primary}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Carteira</Text>
        <BackCircleButton onPress={voltar} color={theme.icon} borderColor={theme.border} />
      </View>

      {loading ? (
        <DLoadingState text="Carregando carteira" color={theme.primary} />
      ) : error ? (
        <DErrorState message={error} onRetry={refetch} />
      ) : (
        <>
          <LinearGradient
            colors={theme.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroRow}>
              <View style={styles.heroText}>
                <Text style={styles.heroKicker}>Ganhos totais</Text>
                <Text style={styles.heroValue}>{formatMoneyFromCents(resumo.ganhosTotais)}</Text>
                <Text style={styles.heroSub}>
                  {resumo.concluidos.length > 0
                    ? `${resumo.concluidos.length} serviço(s) concluído(s) no Dular.`
                    : "Seus ganhos aparecem aqui após concluir serviços."}
                </Text>
              </View>
              <View style={styles.heroIcon}>
                <AppIcon name="Wallet" size={30} color={colors.white} strokeWidth={2.1} />
              </View>
            </View>
          </LinearGradient>

          <View style={styles.metricsGrid}>
            {metric("Este mês", formatMoneyFromCents(resumo.ganhosMes))}
            {metric("Ticket médio", formatMoneyFromCents(resumo.ticketMedio))}
            {metric("A receber", formatMoneyFromCents(resumo.aReceber), "Serviços em andamento")}
            {metric("Concluídos", String(resumo.concluidos.length), "Total de serviços")}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Histórico de serviços</Text>
            {resumo.historico.length > 0 ? (
              <View style={[styles.sectionCard, { borderColor: theme.border }]}>
                {resumo.historico.map((servico, index) => {
                  const badge = statusBadge(servico.status);
                  return (
                    <View
                      key={servico.id}
                      style={[
                        styles.histRow,
                        { borderBottomColor: theme.border },
                        index === resumo.historico.length - 1 && styles.histRowLast,
                      ]}
                    >
                      <View style={[styles.histIcon, { backgroundColor: theme.primarySoft }]}>
                        <AppIcon name="Wrench" size={16} color={theme.primary} />
                      </View>
                      <View style={styles.histText}>
                        <Text style={styles.histTitle} numberOfLines={1}>
                          {labelServico(servico)}
                        </Text>
                        <Text style={styles.histSub} numberOfLines={1}>
                          {servico.empregador?.nome
                            ? `${servico.empregador.nome} · ${formatDataServico(servico.data)}`
                            : formatDataServico(servico.data)}
                        </Text>
                      </View>
                      <View style={styles.histRight}>
                        <Text style={styles.histValue}>{formatMoneyFromCents(valorServico(servico))}</Text>
                        <View style={[styles.histBadge, { backgroundColor: badge.soft }]}>
                          <Text style={[styles.histBadgeText, { color: badge.color }]}>{badge.label}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <DEmptyState
                icon="Wallet"
                title="Sem movimentações ainda"
                subtitle="Quando você concluir serviços, o histórico e os ganhos aparecem aqui."
                accentColor={theme.primary}
                softBg={theme.primarySoft}
              />
            )}
          </View>

          <View style={[styles.note, { borderColor: theme.border }]}>
            <AppIcon name="Info" size={15} color={theme.primary} />
            <Text style={styles.noteText}>
              Acompanhamento financeiro do seu trabalho. Esta tela não movimenta valores nem realiza
              pagamentos.
            </Text>
          </View>
        </>
      )}
    </DScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: 16,
  },
  header: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "700",
  },
  hero: {
    borderRadius: radius.xl,
    padding: 18,
    minHeight: 128,
    justifyContent: "center",
    ...shadows.primaryButton,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
  },
  heroKicker: {
    ...typography.caption,
    color: colors.whiteAlpha80,
    fontWeight: "700",
  },
  heroValue: {
    marginTop: 6,
    fontSize: 30,
    lineHeight: 36,
    color: colors.white,
    fontWeight: "700",
  },
  heroSub: {
    ...typography.bodySm,
    color: colors.whiteAlpha85,
    marginTop: 4,
  },
  heroIcon: {
    width: 60,
    height: 60,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.whiteAlpha20,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metric: {
    flexGrow: 1,
    flexBasis: "47%",
    minHeight: 80,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 14,
    justifyContent: "center",
    gap: 3,
  },
  metricLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "700",
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "800",
  },
  metricHint: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "500",
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.textPrimary,
    ...typography.bodyMedium,
    fontWeight: "700",
    paddingHorizontal: 2,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    ...shadows.soft,
  },
  histRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  histRowLast: {
    borderBottomWidth: 0,
  },
  histIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  histText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  histTitle: {
    color: colors.textPrimary,
    ...typography.bodySm,
    fontWeight: "700",
  },
  histSub: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  histRight: {
    alignItems: "flex-end",
    gap: 5,
  },
  histValue: {
    color: colors.textPrimary,
    ...typography.bodySm,
    fontWeight: "800",
  },
  histBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  histBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  note: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 12,
    backgroundColor: colors.surface,
  },
  noteText: {
    flex: 1,
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "500",
  },
});
