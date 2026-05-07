/**
 * ClienteMinhas — Lista de solicitações do cliente
 *
 * Identidade visual 100% aplicada com tokens Dular validados.
 * Lógica de polling (5s), confirmação e badges de status preservada.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
} from "@react-navigation/native";
import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/lib/api";
import type { MinhasResponse, ServicoListItem as Servico } from "../../../../shared/types/servico";

// ── Tokens ──────────────────────────────────────────────────────────────────
import { colors, radius, shadow, spacing, typography } from "@/theme/tokens";
import { DularBadge } from "@/components/DularBadge";
import { CLIENTE_STACK_ROUTES } from "@/navigation/routes";
import { formatPrice } from "@/utils/formatPrice";

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (v: string | number | Date) => new Date(v).toLocaleDateString("pt-BR");
const statusUp   = (s: any) => String(s ?? "").toUpperCase();

const FINAL = ["CONFIRMADO","FINALIZADO","FINALIZADO_CLIENTE","PAGO","AVALIADO"];

const isConfirmed = (item: any) =>
  Boolean(item?.__confirmedByClient || item?.finishedAt || item?.finalizadoEm || FINAL.includes(statusUp(item?.status)));
const isRated = (item: any) =>
  Boolean(item?.__ratedByClient || item?.avaliacaoCliente || item?.notaCliente || statusUp(item?.status) === "AVALIADO");

function statusLabel(st: string) {
  const s = statusUp(st);
  if (s === "ACEITO")        return "Aceito";
  if (s === "EM_ANDAMENTO")  return "Em andamento";
  if (["CONCLUIDO","CONCLUÍDO"].includes(s)) return "Aguarda sua confirmação";
  if (s === "CONFIRMADO")    return "Confirmado";
  if (s === "FINALIZADO")    return "Finalizado";
  if (["CANCELADO","CANCELADA","RECUSADO","RECUSADA"].includes(s)) return "Cancelado";
  return st || "Status";
}

function statusVariant(st: string): "success" | "warning" | "neutral" | "danger" {
  const s = statusUp(st);
  if (s === "ACEITO")        return "warning";
  if (s === "EM_ANDAMENTO")  return "warning";
  if (["CONCLUIDO","CONCLUÍDO","CONFIRMADO","FINALIZADO"].includes(s)) return "success";
  if (["CANCELADO","CANCELADA","RECUSADO","RECUSADA"].includes(s))     return "danger";
  return "neutral";
}

const POLL_MS = 5000;

// ── Componente ────────────────────────────────────────────────────────────────

export default function ClienteMinhas() {
  const [items, setItems]       = useState<Servico[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const navigation = useNavigation<any>();
  const insets     = useSafeAreaInsets();
  const isFocused  = useIsFocused();

  const load = useCallback(async (mode: "initial" | "refresh" | "poll" = "initial") => {
    try {
      setError(null);
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      const res = await api.get<MinhasResponse>("/api/servicos/minhas");
      setItems(res.data.servicos || []);
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? e?.message ?? "Falha ao carregar";
      setError(msg);
      if (mode !== "poll") Alert.alert("Erro", msg);
    } finally {
      if (mode === "initial") setLoading(false);
      if (mode === "refresh") setRefreshing(false);
    }
  }, []);

  useEffect(() => { load("initial"); }, [load]);
  useFocusEffect(useCallback(() => { load("refresh"); }, [load]));
  useEffect(() => {
    if (!isFocused) return;
    const t = setInterval(() => load("poll"), POLL_MS);
    return () => clearInterval(t);
  }, [isFocused, load]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe} edges={["top","left","right"]}>

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Text style={s.headerTitle}>Minhas solicitações</Text>
        <Text style={s.headerSub}>Acompanhe suas solicitações e avaliações.</Text>
      </View>

      <View style={s.body}>
        <FlashList<Servico>
          data={items}
          keyExtractor={(item: Servico) => item.id}
          estimatedItemSize={120}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} />
          }
          contentContainerStyle={{ paddingBottom: 110 }}
          renderItem={({ item }: ListRenderItemInfo<Servico>) => (
            <Pressable
              onPress={() => navigation.navigate(CLIENTE_STACK_ROUTES.DETALHE, { servico: item })}
              style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}
            >
              {/* Topo: tipo + badge */}
              <View style={s.cardTop}>
                <Text style={s.cardTitle}>{item.tipo} · {item.turno}</Text>
                <DularBadge text={statusLabel(item.status)} variant={statusVariant(item.status)} />
              </View>

              {/* Local + diarista */}
              <Text style={s.cardLocation}>
                {item.bairro} — {item.cidade}/{item.uf}
              </Text>
              <Text style={s.cardDiarista}>
                Diarista: {item.diarista?.nome ?? "Pendente"}
              </Text>

              {/* Badges confirmado / avaliado */}
              {(isConfirmed(item) || isRated(item)) && (
                <View style={s.badgeRow}>
                  {isConfirmed(item) && <DularBadge text="Confirmado" variant="success" />}
                  {isRated(item)     && <DularBadge text="Avaliado"   variant="success" />}
                </View>
              )}

              {/* Preço + data */}
              <View style={s.cardFooter}>
                <Text style={s.cardPrice}>{formatPrice(item.precoFinal)}</Text>
                <Text style={s.cardDate}>Criado em {formatDate(item.createdAt)}</Text>
              </View>

              {/* Notificação de andamento */}
              {["ACEITO","EM_ANDAMENTO"].includes(statusUp(item.status)) && (
                <View style={s.infoBar}>
                  <Ionicons name="information-circle" size={16} color="#0369A1" />
                  <Text style={s.infoBarText}>
                    {item.status === "ACEITO"
                      ? "Sua solicitação foi aceita."
                      : "Serviço em andamento."}
                  </Text>
                </View>
              )}

              {/* Pagamento (placeholder) */}
              {["CONFIRMADO","FINALIZADO"].includes(statusUp(item.status)) && (
                <View style={s.payBar}>
                  <Text style={s.payTitle}>Pagamento</Text>
                  <Text style={s.paySub}>
                    Combine com a diarista (Pix/dinheiro). Pagamento in-app em breve.
                  </Text>
                </View>
              )}
            </Pressable>
          )}
          ListEmptyComponent={
            loading ? (
              <Text style={s.emptyText}>Carregando...</Text>
            ) : error ? (
              <TouchableOpacity onPress={() => load("refresh")}>
                <Text style={{ color: colors.danger, fontWeight: "700" }}>
                  Erro ao carregar. Toque para tentar novamente.
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={s.emptyText}>Nenhum serviço ainda.</Text>
            )
          }
        />
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  header: {
    backgroundColor: colors.bg,
    paddingBottom: 10,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    gap: 4,
  },
  headerTitle: { ...typography.h1, textAlign: "center" },
  headerSub:   { ...typography.sub, textAlign: "center" },

  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: 4,
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stroke,
    padding: 14,
    gap: 6,
    marginBottom: spacing.cardGap,
    ...shadow.card,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle:    { fontSize: 14, fontWeight: "800", color: colors.ink },
  cardLocation: { fontSize: 13, fontWeight: "600", color: colors.ink },
  cardDiarista: { ...typography.sub },
  badgeRow:     { flexDirection: "row", gap: 8, marginTop: 2 },
  cardFooter:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  cardPrice:    { fontSize: 14, fontWeight: "800", color: colors.ink },
  cardDate:     { ...typography.sub },

  infoBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: "#E0F2FE",
    marginTop: 4,
  },
  infoBarText: { fontSize: 13, fontWeight: "600", color: "#0F172A", flex: 1 },

  payBar: {
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.greenLight,
    gap: 4,
    marginTop: 4,
  },
  payTitle: { fontSize: 13, fontWeight: "800", color: colors.greenDark },
  paySub:   { fontSize: 12, color: colors.greenDark, lineHeight: 17 },

  emptyText: { ...typography.sub, textAlign: "center", marginTop: 32 },
});
