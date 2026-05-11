/**
 * DiaristaCarteira — Painel de acompanhamento da diarista
 *
 * Exibe:
 *  - total de serviços concluídos no mês
 *  - faturamento estimado do mês
 *  - lista dos últimos serviços concluídos (com valor)
 *
 * Sem função de carteira / pagamento. Apenas leitura.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";

import { colors, radius, shadow, spacing, typography } from "@/theme/tokens";

const MONEY_UNIT = (process.env.EXPO_PUBLIC_MONEY_UNIT || "centavos").toLowerCase();
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type ServicoConcluido = {
  id: string;
  titulo: string;
  cliente: string;
  dataISO: string;
  valor: number;
};

const STATUS_CONCLUIDO = new Set([
  "FINALIZADO",
  "CONCLUIDO",
  "CONCLUÍDO",
  "CONFIRMADO",
  "PAGO",
  "FINALIZED",
  "DONE",
]);

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

function mesAtualLabel() {
  const m = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return m.charAt(0).toUpperCase() + m.slice(1);
}

export default function DiaristaCarteira() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [servicos, setServicos] = useState<ServicoConcluido[]>([]);

  const load = useCallback(async (isRefresh = false) => {
    try {
      setError(null);
      isRefresh ? setRefreshing(true) : setLoading(true);

      const res = await api.get("/api/servicos/minhas");
      const lista = Array.isArray(res.data?.servicos)
        ? res.data.servicos
        : Array.isArray(res.data)
          ? res.data
          : [];

      const concluidos: ServicoConcluido[] = (lista as any[])
        .filter((s) => STATUS_CONCLUIDO.has(String(s?.status ?? "").toUpperCase()))
        .map((s): ServicoConcluido => ({
          id: String(s?.id ?? Math.random()),
          titulo: tituloServico(s),
          cliente: s?.cliente?.nome ?? s?.clienteNome ?? "Cliente",
          dataISO: getDataISO(s),
          valor: getValor(s),
        }))
        .sort((a, b) => +new Date(b.dataISO) - +new Date(a.dataISO));

      setServicos(concluidos);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar dados.");
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(false); }, [load]));

  const { totalMes, faturamentoMes, ultimos } = useMemo(() => {
    const doMes = servicos.filter((s) => isInCurrentMonth(s.dataISO));
    return {
      totalMes: doMes.length,
      faturamentoMes: doMes.reduce((acc, s) => acc + s.valor, 0),
      ultimos: servicos.slice(0, 8),
    };
  }, [servicos]);

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Cabeçalho ─── */}
        <Text style={s.titulo}>Meu desempenho</Text>
        <Text style={s.subtitulo}>{mesAtualLabel()}</Text>

        {/* ─── Métricas do mês ─── */}
        <View style={s.metricsRow}>
          <View style={s.metricCard}>
            <View style={s.metricIcon}>
              <Ionicons name="briefcase" size={20} color={colors.primary} />
            </View>
            <Text style={s.metricLabel}>Serviços no mês</Text>
            <Text style={s.metricValue}>{loading ? "—" : totalMes}</Text>
          </View>

          <View style={s.metricCard}>
            <View style={[s.metricIcon, { backgroundColor: colors.muted }]}>
              <Ionicons name="trending-up" size={20} color={colors.accent} />
            </View>
            <Text style={s.metricLabel}>Faturamento estimado</Text>
            <Text style={s.metricValue}>{loading ? "—" : brl(faturamentoMes)}</Text>
          </View>
        </View>

        {/* ─── Erro ─── */}
        {error ? (
          <View style={s.errorCard}>
            <Text style={s.errorTitle}>Não foi possível carregar.</Text>
            <Text style={s.errorSub}>{error}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={() => load(false)}>
              <Text style={s.retryText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ─── Últimos serviços concluídos ─── */}
        <View style={s.sectionHead}>
          <Text style={s.sectionTitle}>Últimos serviços concluídos</Text>
        </View>

        {loading ? (
          <View style={s.skeleton} />
        ) : ultimos.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="checkmark-done-outline" size={22} color={colors.mutedForeground} />
            <Text style={s.emptyText}>Nenhum serviço concluído ainda.</Text>
          </View>
        ) : (
          ultimos.map((item) => (
            <View key={item.id} style={s.itemCard}>
              <View style={s.itemIcon}>
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              </View>

              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.itemTitle} numberOfLines={1}>{item.titulo}</Text>
                <Text style={s.itemSub} numberOfLines={1}>
                  {item.cliente} · {new Date(item.dataISO).toLocaleDateString("pt-BR")}
                </Text>
              </View>

              <Text style={s.itemValor}>{brl(item.valor)}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 10,
    paddingBottom: 120,
  },

  titulo: {
    ...typography.h2,
    fontWeight: "700",
    color: colors.foreground,
    letterSpacing: -0.4,
  },
  subtitulo: {
    ...typography.caption,
    color: colors.mutedForeground,
    fontWeight: "600",
    marginTop: 2,
    marginBottom: 14,
  },

  // Métricas
  metricsRow: { flexDirection: "row", gap: 12 },
  metricCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 6,
    ...shadow.card,
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  metricLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
    fontWeight: "600",
  },
  metricValue: {
    ...typography.title,
    fontWeight: "700",
    color: colors.foreground,
    letterSpacing: -0.6,
  },

  // Seção
  sectionHead: { marginTop: 22, marginBottom: 12 },
  sectionTitle: {
    ...typography.bodyMedium,
    fontWeight: "700",
    color: colors.foreground,
    letterSpacing: -0.2,
  },

  // Item
  skeleton: {
    height: 96,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    opacity: 0.55,
  },
  emptyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: 12,
  },
  emptyText: {
    ...typography.bodySm,
    color: colors.mutedForeground,
    fontWeight: "600",
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
    ...shadow.card,
  },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitle: {
    ...typography.bodySmMedium,
    fontWeight: "700",
    color: colors.foreground,
  },
  itemSub: {
    ...typography.caption,
    color: colors.mutedForeground,
    fontWeight: "500",
  },
  itemValor: {
    ...typography.bodySmMedium,
    fontWeight: "700",
    color: colors.primary,
  },

  // Erro
  errorCard: {
    marginTop: 16,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  errorTitle: {
    ...typography.bodySmMedium,
    fontWeight: "700",
    color: colors.destructive,
  },
  errorSub: {
    ...typography.caption,
    color: colors.mutedForeground,
    fontWeight: "500",
  },
  retryBtn: {
    marginTop: 4,
    height: 38,
    borderRadius: radius.btn,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.foreground,
  },
  retryText: {
    color: colors.card,
    ...typography.bodySm,
    fontWeight: "700",
  },
});
