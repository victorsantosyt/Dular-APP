/**
 * DiaristaCarteira — acompanhamento financeiro da diarista.
 *
 * Mesma estrutura da Carteira do montador (hero "Ganhos totais" + métricas +
 * histórico de serviços + nota), adaptada à fonte de dados da diarista
 * (/api/servicos/minhas). Não é carteira transacional: só monitoramento, não
 * movimenta valores nem realiza pagamentos.
 */

import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";

import { AppIcon, BackCircleButton, DEmptyState, DErrorState, DLoadingState, DScreen } from "@/components/ui";
import { fetchServicosMinhas } from "@/api/sharedFetcher";
import { useGenderTheme } from "@/hooks/useProfileTheme";
import type { DiaristaTabParamList } from "@/navigation/DiaristaNavigator";
import { colors, radius, shadows, spacing, typography } from "@/theme";

type Navigation = BottomTabNavigationProp<DiaristaTabParamList>;

const MONEY_UNIT = (process.env.EXPO_PUBLIC_MONEY_UNIT || "centavos").toLowerCase();
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_CONCLUIDO = new Set(["FINALIZADO", "CONCLUIDO", "CONCLUÍDO", "PAGO", "FINALIZED", "DONE"]);
const STATUS_A_RECEBER = new Set([
  "ACEITA",
  "ACEITO",
  "CONFIRMADO",
  "ANDAMENTO",
  "EM_ANDAMENTO",
  "AGENDADO",
  "AGUARDANDO_FINALIZACAO",
]);

type ServicoCarteira = {
  id: string;
  titulo: string;
  cliente: string;
  dataISO: string;
  valor: number;
  status: string;
};

function toNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeMoney(v: any) {
  const n = toNumber(v);
  if (MONEY_UNIT === "centavos") return n / 100;
  if (MONEY_UNIT === "reais") return n;
  if (n >= 1000 && Number.isInteger(n)) return n / 100;
  return n;
}

function getValor(s: any) {
  return normalizeMoney(s?.valorTotal ?? s?.valor ?? s?.precoFinal ?? s?.preco ?? s?.price ?? 0);
}

function getDataISO(s: any) {
  return s?.finishedAt ?? s?.finalizadoEm ?? s?.updatedAt ?? s?.data ?? s?.createdAt ?? new Date().toISOString();
}

function tituloServico(s: any) {
  const tipo = String(s?.tipo ?? s?.tipoServico ?? "Serviço").replace(/_/g, " ").toLowerCase();
  return tipo.charAt(0).toUpperCase() + tipo.slice(1);
}

function isInCurrentMonth(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function formatDataServico(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Data a combinar";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

type Badge = { label: string; color: string; soft: string };

function statusBadge(status: string): Badge {
  const s = status.toUpperCase();
  if (STATUS_CONCLUIDO.has(s)) return { label: "Concluído", color: colors.success, soft: colors.successSoft };
  if (s === "EM_ANDAMENTO" || s === "ANDAMENTO")
    return { label: "Em andamento", color: colors.warning, soft: colors.warningSoft };
  if (s === "AGUARDANDO_FINALIZACAO")
    return { label: "Aguardando", color: colors.warning, soft: colors.warningSoft };
  return { label: "Agendado", color: colors.textSecondary, soft: colors.background };
}

export default function DiaristaCarteira() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute();
  const theme = useGenderTheme("DIARISTA");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [servicos, setServicos] = useState<ServicoCarteira[]>([]);

  // Stack real (#103): volta para a tela de origem (push/goBack).
  const voltar = () => navigation.goBack();

  const load = useCallback(async (isRefresh = false) => {
    try {
      setError(null);
      isRefresh ? setRefreshing(true) : setLoading(true);

      const data = await fetchServicosMinhas();
      const lista = Array.isArray(data?.servicos) ? data.servicos : Array.isArray(data) ? data : [];

      const mapped: ServicoCarteira[] = (lista as any[])
        .map((s): ServicoCarteira => ({
          id: String(s?.id ?? Math.random()),
          titulo: tituloServico(s),
          cliente: s?.cliente?.nome ?? s?.clienteNome ?? "Cliente",
          dataISO: getDataISO(s),
          valor: getValor(s),
          status: String(s?.status ?? "").toUpperCase(),
        }))
        .sort((a, b) => +new Date(b.dataISO) - +new Date(a.dataISO));

      setServicos(mapped);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar dados.");
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(false); }, [load]));

  const resumo = useMemo(() => {
    const concluidos = servicos.filter((s) => STATUS_CONCLUIDO.has(s.status));
    const pendentesReceber = servicos.filter((s) => STATUS_A_RECEBER.has(s.status));
    const ganhosTotais = concluidos.reduce((sum, s) => sum + s.valor, 0);
    const ganhosMes = concluidos.filter((s) => isInCurrentMonth(s.dataISO)).reduce((sum, s) => sum + s.valor, 0);
    const ticketMedio = concluidos.length ? ganhosTotais / concluidos.length : 0;
    const aReceber = pendentesReceber.reduce((sum, s) => sum + s.valor, 0);
    const historico = [...concluidos, ...pendentesReceber].sort(
      (a, b) => +new Date(b.dataISO) - +new Date(a.dataISO),
    );
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
      onRefresh={() => load(true)}
      refreshTintColor={theme.primary}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Carteira</Text>
        <BackCircleButton onPress={voltar} color={theme.icon} borderColor={theme.border} />
      </View>

      {loading ? (
        <DLoadingState text="Carregando carteira" color={theme.primary} />
      ) : error ? (
        <DErrorState message={error} onRetry={() => load(false)} />
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
                <Text style={styles.heroValue}>{brl(resumo.ganhosTotais)}</Text>
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
            {metric("Este mês", brl(resumo.ganhosMes))}
            {metric("Ticket médio", brl(resumo.ticketMedio))}
            {metric("A receber", brl(resumo.aReceber), "Serviços em andamento")}
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
                        <AppIcon name="BrushCleaning" size={16} color={theme.primary} />
                      </View>
                      <View style={styles.histText}>
                        <Text style={styles.histTitle} numberOfLines={1}>
                          {servico.titulo}
                        </Text>
                        <Text style={styles.histSub} numberOfLines={1}>
                          {servico.cliente} · {formatDataServico(servico.dataISO)}
                        </Text>
                      </View>
                      <View style={styles.histRight}>
                        <Text style={styles.histValue}>{brl(servico.valor)}</Text>
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
