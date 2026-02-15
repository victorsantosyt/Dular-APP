import React, { useEffect, useState, useCallback } from "react";
import { View, Text, Alert, RefreshControl, Pressable, TouchableOpacity } from "react-native";
import { useFocusEffect, useNavigation, useIsFocused } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../lib/api";
import { MinhasResponse, Servico } from "../../types/servico";
import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../../theme/theme";

const HEADER_TOP = "#e8f5f0";
const HEADER_BOTTOM = "#f6fbf8";

function statusLabel(st: string) {
  const s = (st || "").toUpperCase();
  if (["ACEITO"].includes(s)) return "Aceito";
  if (["EM_ANDAMENTO"].includes(s)) return "Em andamento";
  if (["CONCLUIDO", "CONCLUÍDO"].includes(s)) return "Concluído (confirme)";
  if (["CONFIRMADO"].includes(s)) return "Confirmado";
  if (["FINALIZADO"].includes(s)) return "Finalizado";
  if (["CANCELADO", "CANCELADA", "RECUSADO", "RECUSADA"].includes(s)) return "Cancelado";
  return s || "Status";
}

function statusBadgeColor(st: string) {
  const s = (st || "").toUpperCase();
  if (["ACEITO"].includes(s)) return { bg: "#E0F2FE", fg: "#0369A1" };
  if (["EM_ANDAMENTO"].includes(s)) return { bg: "#FEF3C7", fg: "#92400E" };
  if (["CONCLUIDO", "CONCLUÍDO", "CONFIRMADO", "FINALIZADO"].includes(s)) return { bg: "#EAF7F0", fg: "#15803D" };
  if (["CANCELADO", "CANCELADA", "RECUSADO", "RECUSADA"].includes(s)) return { bg: "#FEE2E2", fg: "#B91C1C" };
  return { bg: "#E5E7EB", fg: "#374151" };
}

const brl = (v: number) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatDate = (v: string | number | Date) => new Date(v).toLocaleDateString("pt-BR");
const statusUpper = (s: any) => String(s ?? "").toUpperCase();
const isFinalStatus = (s: any) =>
  ["CONFIRMADO", "FINALIZADO", "FINALIZADO_CLIENTE", "CONCLUIDO", "CONCLUÍDO", "PAGO", "AVALIADO"].includes(statusUpper(s));
const isConfirmed = (item: any) =>
  Boolean(item?.__confirmedByClient || item?.finishedAt || item?.finalizadoEm || isFinalStatus(item?.status));
const isRated = (item: any) =>
  Boolean(item?.__ratedByClient || item?.avaliacaoCliente || item?.notaCliente || statusUpper(item?.status) === "AVALIADO");

export default function ClienteMinhas() {
  const [items, setItems] = useState<Servico[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation<any>();
  const POLL_MS = 5000; // atualiza a cada 5s para refletir aceite/andamento rapidamente
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const load = useCallback(
    async (mode: "initial" | "refresh" | "poll" = "initial") => {
      try {
        setError(null);
        if (mode === "initial") setLoading(true);
        if (mode === "refresh") setRefreshing(true);
        // no spinner em modo poll

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
    },
    []
  );

  useEffect(() => {
    load("initial");
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load("refresh");
    }, [load])
  );

  useEffect(() => {
    if (!isFocused) return;
    const timer = setInterval(() => load("poll"), POLL_MS);
    return () => clearInterval(timer);
  }, [isFocused, load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: HEADER_TOP }} edges={["top", "left", "right", "bottom"]}>
      <LinearGradient
        colors={[HEADER_TOP, HEADER_BOTTOM]}
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 10,
          paddingHorizontal: 16,
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 24, fontWeight: "800", color: colors.text, textAlign: "center" }}>
          Minhas solicitações
        </Text>
        <Text style={{ color: colors.muted, marginTop: 4, textAlign: "center", fontSize: 14 }}>
          Acompanhe suas solicitações e avaliações.
        </Text>
      </LinearGradient>

      <View
        style={{
          flex: 1,
          paddingHorizontal: 16,
          paddingTop: 4,
          paddingBottom: Math.max(12, insets.bottom + 8),
          backgroundColor: HEADER_BOTTOM,
        }}
      >
        <FlashList<Servico>
          data={items}
          keyExtractor={(item: { id: any; }) => item.id}
          estimatedItemSize={80}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} />}
          contentContainerStyle={{ paddingBottom: 30 }}
          renderItem={({ item }: ListRenderItemInfo<Servico>) => (
            <Pressable onPress={() => navigation.navigate("ClienteDetalhe", { servico: item })} style={card}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <Text style={{ fontWeight: "800", color: colors.text }}>
                  {item.tipo} • {item.turno}
                </Text>
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: statusBadgeColor(item.status).bg,
                  }}
                >
                  <Text style={{ fontWeight: "700", color: statusBadgeColor(item.status).fg, fontSize: 12 }}>
                    {statusLabel(item.status)}
                  </Text>
                </View>
              </View>

              <Text style={{ color: colors.text }}>
                {item.bairro} — {item.cidade}/{item.uf}
              </Text>
              <Text style={{ color: colors.muted }}>
                Diarista: {item.diarista?.nome ? item.diarista?.nome : "Pendente"}
              </Text>

              {(isConfirmed(item) || isRated(item)) && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                  {isConfirmed(item) && (
                    <View style={{ backgroundColor: "#DBEAFE", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }}>
                      <Text style={{ color: "#1D4ED8", fontWeight: "800", fontSize: 12 }}>Confirmado</Text>
                    </View>
                  )}
                  {isRated(item) && (
                    <View style={{ backgroundColor: "#DCFCE7", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }}>
                      <Text style={{ color: "#166534", fontWeight: "800", fontSize: 12 }}>Avaliado</Text>
                    </View>
                  )}
                </View>
              )}

              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                <Text style={{ color: colors.text, fontWeight: "800" }}>Preço: {brl(item.precoFinal / 100)}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Criado em {formatDate(item.createdAt)}</Text>
              </View>

              {/* Notificação visual de andamento */}
              {["ACEITO", "EM_ANDAMENTO"].includes((item.status || "").toUpperCase()) && (
                <View style={{ marginTop: 6, padding: 10, borderRadius: 12, backgroundColor: "#E0F2FE" }}>
                  <Text style={{ color: "#0F172A", fontWeight: "700" }}>
                    {item.status === "ACEITO" ? "Sua solicitação foi aceita." : "Serviço em andamento."}
                  </Text>
                  <Text style={{ color: "#334155", marginTop: 2, fontSize: 12 }}>
                    Você pode acompanhar aqui e combinar detalhes com a diarista.
                  </Text>
                </View>
              )}

              {/* Opções de pagamento (placeholder) */}
              {["CONFIRMADO", "FINALIZADO"].includes((item.status || "").toUpperCase()) && (
                <View style={{ marginTop: 10, padding: 12, borderRadius: 14, backgroundColor: "#EAF7F0", gap: 6 }}>
                  <Text style={{ color: "#166534", fontWeight: "800" }}>Pagamento</Text>
                  <Text style={{ color: "#166534", fontSize: 13, lineHeight: 18 }}>
                    Combine pagamento direto com a diarista (Pix/dinheiro). Pagamento in-app em breve.
                  </Text>
                  <View
                    style={{
                      alignSelf: "flex-start",
                      backgroundColor: "#CFEFDD",
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 999,
                      opacity: 0.9,
                    }}
                  >
                    <Text style={{ color: "#166534", fontWeight: "700" }}>Pagamento no app (em breve)</Text>
                  </View>
                </View>
              )}
            </Pressable>
          )}
          ListEmptyComponent={
            loading ? (
              <Text style={{ color: colors.muted }}>Carregando...</Text>
            ) : error ? (
              <TouchableOpacity onPress={() => load("refresh")}>
                <Text style={{ color: "#B91C1C" }}>Erro ao carregar. Tocar para tentar de novo.</Text>
              </TouchableOpacity>
            ) : (
              <Text style={{ color: colors.muted }}>Nenhum serviço ainda.</Text>
            )
          }
        />
      </View>
    </SafeAreaView>
  );
}

const card = {
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 12,
  padding: 12,
  backgroundColor: colors.card,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 4,
  elevation: 2,
  gap: 4,
};
