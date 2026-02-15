import React, { useCallback, useMemo, useState } from "react";
import { View, Text, RefreshControl, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../../lib/api";

const BG = "#ECF7F1";
// Backend retornando precoFinal em centavos (ex.: 15000 = R$150,00). Ajuste via .env se mudar.
const MONEY_UNIT = (process.env.EXPO_PUBLIC_MONEY_UNIT || "centavos").toLowerCase();
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type ExtratoItem = {
  id: string;
  titulo: string;
  subtitulo: string;
  dataISO: string;
  status: string;
  valor: number; // em reais
  tipo: "ENTRADA" | "PENDENTE";
};

function toNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeMoney(v: any) {
  const n = toNumber(v);

  if (MONEY_UNIT === "centavos") return n / 100;
  if (MONEY_UNIT === "reais") return n;

  // AUTO (fallback)
  if (n >= 1000 && Number.isInteger(n)) return n / 100;
  return n;
}

function getValor(s: any) {
  return normalizeMoney(s?.valorTotal ?? s?.valor ?? s?.precoFinal ?? s?.preco ?? s?.price ?? 0);
}

function normalizeStatus(s: any) {
  return String(s ?? "").trim().toUpperCase();
}

function statusToTipo(status: string): "ENTRADA" | "PENDENTE" | "IGNORAR" {
  const st = normalizeStatus(status);
  if (["CANCELADO", "CANCELADA", "CANCELLED", "RECUSADO", "RECUSADA"].includes(st)) return "IGNORAR";

  const entrada = ["FINALIZADO", "CONCLUIDO", "CONCLUÍDO", "CONFIRMADO", "PAGO", "FINALIZED", "DONE"];
  if (entrada.includes(st)) return "ENTRADA";
  return "PENDENTE";
}

function statusLabel(raw: string) {
  const st = normalizeStatus(raw);
  if (["FINALIZADO", "CONCLUIDO", "CONCLUÍDO", "CONFIRMADO", "PAGO", "FINALIZED", "DONE"].includes(st))
    return "Concluído";
  if (["ACEITO", "EM_ANDAMENTO", "ANDAMENTO", "PENDENTE", "AGUARDANDO", "IN_PROGRESS"].includes(st))
    return "Pendente";
  if (["CANCELADO", "CANCELADA", "CANCELLED", "RECUSADO", "RECUSADA"].includes(st)) return "Cancelado";
  return "Em análise";
}

function buildCarteira(servicos: any[]) {
  const extrato: ExtratoItem[] = (servicos || [])
    .map((s) => {
    const status = s?.status ?? s?.estado ?? "DESCONHECIDO";
    const tipo = statusToTipo(status);
    const valor = getValor(s);

    if (tipo === "IGNORAR") return null;

    return {
      id: String(s?.id ?? Math.random()),
      titulo: s?.tipo ?? s?.tipoServico ?? s?.titulo ?? "Serviço",
      subtitulo: s?.cliente?.nome ?? s?.clienteNome ?? "Cliente",
      dataISO: s?.finishedAt ?? s?.finalizadoEm ?? s?.updatedAt ?? s?.createdAt ?? new Date().toISOString(),
      status: String(status),
      tipo,
      valor,
    };
  })
    .filter(Boolean) as ExtratoItem[];

  extrato.sort((a, b) => +new Date(b.dataISO) - +new Date(a.dataISO));

  const saldoDisponivel = extrato
    .filter((e) => e.tipo === "ENTRADA")
    .reduce((acc, e) => acc + e.valor, 0);

  const saldoPendente = extrato
    .filter((e) => e.tipo === "PENDENTE")
    .reduce((acc, e) => acc + e.valor, 0);

  return { saldoDisponivel, saldoPendente, extrato };
}

export default function DiaristaCarteira() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [saldoDisponivel, setSaldoDisponivel] = useState(0);
  const [saldoPendente, setSaldoPendente] = useState(0);
  const [extrato, setExtrato] = useState<ExtratoItem[]>([]);

  const saqueDisponivel = false; // por enquanto não há endpoint de saque

  const loadCarteira = useCallback(async (isRefresh = false) => {
    try {
      setError(null);
      isRefresh ? setRefreshing(true) : setLoading(true);

      const res = await api.get("/api/servicos/minhas");
      const servicos = Array.isArray(res.data?.servicos) ? res.data.servicos : Array.isArray(res.data) ? res.data : [];

      if (__DEV__ && Array.isArray(servicos) && servicos.length > 0) {
        console.log("[CARTEIRA] exemplo /api/servicos/minhas:", JSON.stringify(servicos[0], null, 2));
      }

      const c = buildCarteira(servicos);
      setSaldoDisponivel(c.saldoDisponivel);
      setSaldoPendente(c.saldoPendente);
      setExtrato(c.extrato);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar carteira.");
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCarteira(false);
    }, [loadCarteira])
  );

  const header = useMemo(
    () => (
      <View style={{ borderRadius: 18, padding: 18, backgroundColor: "white" }}>
        <Text style={{ fontSize: 13, color: "#6B7280", fontWeight: "600" }}>Saldo disponível</Text>
        <Text style={{ fontSize: 34, color: "#0F172A", fontWeight: "800", marginTop: 6 }}>
          {loading ? "—" : brl(saldoDisponivel)}
        </Text>

        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
          <Text style={{ fontSize: 13, color: "#6B7280" }}>Pendente</Text>
          <Text style={{ fontSize: 13, color: "#0F172A", fontWeight: "700" }}>
            {loading ? "—" : brl(saldoPendente)}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => {}}
          disabled={!saqueDisponivel}
          style={{
            marginTop: 14,
            height: 48,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: saqueDisponivel ? "#2E8C8F" : "#D1D5DB",
          }}
        >
          <Text style={{ color: saqueDisponivel ? "white" : "#6B7280", fontWeight: "800", fontSize: 16 }}>
            Solicitar saque
          </Text>
          {!saqueDisponivel && (
            <Text style={{ marginTop: 2, fontSize: 11, color: "#6B7280" }}>Em breve</Text>
          )}
        </TouchableOpacity>
      </View>
    ),
    [loading, saldoDisponivel, saldoPendente, saqueDisponivel]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }} edges={["top", "left", "right"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 18, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadCarteira(true)} />}
      >
        {header}

        {error && (
          <View style={{ marginTop: 12, padding: 14, borderRadius: 16, backgroundColor: "white" }}>
            <Text style={{ color: "#B91C1C", fontWeight: "800" }}>Não foi possível carregar.</Text>
            <Text style={{ color: "#6B7280", marginTop: 6 }}>{error}</Text>
            <TouchableOpacity
              onPress={() => loadCarteira(false)}
              style={{
                marginTop: 12,
                height: 44,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#0F172A",
              }}
            >
              <Text style={{ color: "white", fontWeight: "800" }}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={{ marginTop: 16, marginBottom: 10, fontWeight: "800", fontSize: 16, color: "#0F172A" }}>
          Extrato
        </Text>

        {loading ? (
          <View style={{ height: 140, borderRadius: 16, backgroundColor: "white", opacity: 0.6 }} />
        ) : extrato.length === 0 ? (
          <View style={{ padding: 16, borderRadius: 16, backgroundColor: "white" }}>
            <Text style={{ color: "#6B7280" }}>Sem movimentações por aqui ainda.</Text>
          </View>
        ) : (
          extrato.map((e) => (
            <View key={e.id} style={{ padding: 14, borderRadius: 16, backgroundColor: "white", marginBottom: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={{ fontWeight: "900", color: "#0F172A" }}>{e.titulo}</Text>
                  <Text style={{ marginTop: 2, color: "#6B7280", fontSize: 12 }} numberOfLines={1}>
                    {e.subtitulo} • {new Date(e.dataISO).toLocaleDateString("pt-BR")}
                  </Text>
                </View>

                <Text style={{ fontWeight: "900", color: "#0F172A" }}>
                  {(e.tipo === "ENTRADA" ? "+" : "") + brl(e.valor)}
                </Text>
              </View>

              <Text style={{ marginTop: 6, color: "#6B7280", fontSize: 12 }}>
                Status: {statusLabel(e.status)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
