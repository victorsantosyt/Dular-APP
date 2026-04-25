/**
 * DiaristaCarteira — Carteira da diarista
 *
 * Identidade visual 100% aplicada com tokens Dular validados.
 * Toda a lógica de normalização de moeda preservada.
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

// ── Tokens Dular ──────────────────────────────────────────────────────────────
import { colors, radius, shadow, spacing, typography } from "@/theme/tokens";

// ── Helpers de moeda (preservados) ───────────────────────────────────────────
const MONEY_UNIT = (process.env.EXPO_PUBLIC_MONEY_UNIT || "centavos").toLowerCase();
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type ExtratoItem = {
  id: string;
  titulo: string;
  subtitulo: string;
  dataISO: string;
  status: string;
  valor: number;
  tipo: "ENTRADA" | "PENDENTE";
};

function toNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeMoney(v: any) {
  const n = toNumber(v);
  if (MONEY_UNIT === "centavos") return n / 100;
  if (MONEY_UNIT === "reais")    return n;
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
  if (["CANCELADO","CANCELADA","CANCELLED","RECUSADO","RECUSADA"].includes(st)) return "IGNORAR";
  if (["FINALIZADO","CONCLUIDO","CONCLUÍDO","CONFIRMADO","PAGO","FINALIZED","DONE"].includes(st)) return "ENTRADA";
  return "PENDENTE";
}

function statusLabel(raw: string) {
  const st = normalizeStatus(raw);
  if (["FINALIZADO","CONCLUIDO","CONCLUÍDO","CONFIRMADO","PAGO","FINALIZED","DONE"].includes(st)) return "Concluído";
  if (["ACEITO","EM_ANDAMENTO","ANDAMENTO","PENDENTE","AGUARDANDO","IN_PROGRESS"].includes(st)) return "Pendente";
  if (["CANCELADO","CANCELADA","CANCELLED","RECUSADO","RECUSADA"].includes(st)) return "Cancelado";
  return "Em análise";
}

function buildCarteira(servicos: any[]) {
  const extrato: ExtratoItem[] = (servicos || [])
    .map((s) => {
      const status = s?.status ?? s?.estado ?? "DESCONHECIDO";
      const tipo   = statusToTipo(status);
      const valor  = getValor(s);
      if (tipo === "IGNORAR") return null;
      return {
        id:        String(s?.id ?? Math.random()),
        titulo:    s?.tipo ?? s?.tipoServico ?? s?.titulo ?? "Serviço",
        subtitulo: s?.cliente?.nome ?? s?.clienteNome ?? "Cliente",
        dataISO:   s?.finishedAt ?? s?.finalizadoEm ?? s?.updatedAt ?? s?.createdAt ?? new Date().toISOString(),
        status:    String(status),
        tipo,
        valor,
      };
    })
    .filter(Boolean) as ExtratoItem[];

  extrato.sort((a, b) => +new Date(b.dataISO) - +new Date(a.dataISO));

  const saldoDisponivel = extrato.filter((e) => e.tipo === "ENTRADA").reduce((acc, e) => acc + e.valor, 0);
  const saldoPendente   = extrato.filter((e) => e.tipo === "PENDENTE").reduce((acc, e) => acc + e.valor, 0);
  return { saldoDisponivel, saldoPendente, extrato };
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function DiaristaCarteira() {
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [saldoDisponivel, setSaldoDisponivel] = useState(0);
  const [saldoPendente, setSaldoPendente]     = useState(0);
  const [extrato, setExtrato]       = useState<ExtratoItem[]>([]);

  const saqueDisponivel = false; // endpoint de saque não disponível ainda

  const loadCarteira = useCallback(async (isRefresh = false) => {
    try {
      setError(null);
      isRefresh ? setRefreshing(true) : setLoading(true);

      const res      = await api.get("/api/servicos/minhas");
      const servicos = Array.isArray(res.data?.servicos)
        ? res.data.servicos
        : Array.isArray(res.data) ? res.data : [];

      if (__DEV__ && servicos.length > 0) {
        console.log("[CARTEIRA]", JSON.stringify(servicos[0], null, 2));
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

  useFocusEffect(useCallback(() => { loadCarteira(false); }, [loadCarteira]));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadCarteira(true)} />
        }
      >

        {/* ── Card de saldo ── */}
        <View style={s.saldoCard}>
          {/* Indicador de ícone */}
          <View style={s.saldoIcon}>
            <Ionicons name="wallet" size={22} color={colors.green} />
          </View>

          <Text style={s.saldoLabel}>Saldo disponível</Text>
          <Text style={s.saldoValue}>
            {loading ? "—" : brl(saldoDisponivel)}
          </Text>

          {/* Pendente */}
          <View style={s.pendRow}>
            <Text style={s.pendLabel}>Pendente</Text>
            <Text style={s.pendValue}>{loading ? "—" : brl(saldoPendente)}</Text>
          </View>

          {/* Separador */}
          <View style={s.divider} />

          {/* Botão de saque */}
          <TouchableOpacity
            onPress={() => {}}
            disabled={!saqueDisponivel}
            style={[s.saqueBtn, !saqueDisponivel && s.saqueBtnDisabled]}
          >
            <Text style={[s.saqueBtnText, !saqueDisponivel && s.saqueBtnTextDisabled]}>
              Solicitar saque
            </Text>
            {!saqueDisponivel && (
              <Text style={s.saqueSoon}>Em breve</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Erro ── */}
        {error && (
          <View style={s.errorCard}>
            <Text style={s.errorTitle}>Não foi possível carregar.</Text>
            <Text style={s.errorSub}>{error}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={() => loadCarteira(false)}>
              <Text style={s.retryText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Extrato ── */}
        <Text style={s.extratoTitle}>Extrato</Text>

        {loading ? (
          <View style={s.skeleton} />
        ) : extrato.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>Sem movimentações por aqui ainda.</Text>
          </View>
        ) : (
          extrato.map((e) => (
            <View key={e.id} style={s.extratoItem}>
              {/* Ícone de tipo */}
              <View style={[s.extratoIcon, e.tipo === "ENTRADA" ? s.extratoIconEntrada : s.extratoIconPendente]}>
                <Ionicons
                  name={e.tipo === "ENTRADA" ? "checkmark-circle" : "time"}
                  size={18}
                  color={e.tipo === "ENTRADA" ? colors.greenDark : colors.sub}
                />
              </View>

              {/* Info */}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.extratoNome}>{e.titulo}</Text>
                <Text style={s.extratoSub} numberOfLines={1}>
                  {e.subtitulo} · {new Date(e.dataISO).toLocaleDateString("pt-BR")}
                </Text>
                <Text style={s.extratoStatus}>Status: {statusLabel(e.status)}</Text>
              </View>

              {/* Valor */}
              <Text style={[s.extratoValor, e.tipo === "ENTRADA" && s.extratoValorEntrada]}>
                {(e.tipo === "ENTRADA" ? "+" : "") + brl(e.valor)}
              </Text>
            </View>
          ))
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: 110,
    gap: 10,
  },

  // Saldo card
  saldoCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stroke,
    padding: 18,
    gap: 6,
    ...shadow.card,
  },
  saldoIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.greenLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  saldoLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.sub,
  },
  saldoValue: {
    fontSize: 34,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -1,
    marginTop: 2,
  },
  pendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 6,
  },
  pendLabel: {
    fontSize: 13,
    color: colors.sub,
  },
  pendValue: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink,
  },
  divider: {
    height: 1,
    backgroundColor: colors.stroke,
    marginVertical: 6,
  },
  saqueBtn: {
    height: 48,
    borderRadius: radius.btn,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green,
    gap: 2,
  },
  saqueBtnDisabled: {
    backgroundColor: colors.stroke,
  },
  saqueBtnText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 15,
  },
  saqueBtnTextDisabled: {
    color: colors.sub,
  },
  saqueSoon: {
    fontSize: 11,
    color: colors.sub,
  },

  // Erro
  errorCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stroke,
    padding: 14,
    gap: 8,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.danger,
  },
  errorSub: {
    ...typography.sub,
  },
  retryBtn: {
    marginTop: 4,
    height: 42,
    borderRadius: radius.btn,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink,
  },
  retryText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 13,
  },

  // Extrato
  extratoTitle: {
    ...typography.h2,
    marginTop: 6,
  },
  skeleton: {
    height: 120,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    opacity: 0.6,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stroke,
    padding: 16,
  },
  emptyText: {
    ...typography.sub,
  },
  extratoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stroke,
    padding: 14,
    ...shadow.card,
  },
  extratoIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  extratoIconEntrada: {
    backgroundColor: colors.greenLight,
  },
  extratoIconPendente: {
    backgroundColor: "#F4F7F5",
  },
  extratoNome: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.ink,
  },
  extratoSub: {
    ...typography.sub,
  },
  extratoStatus: {
    fontSize: 11,
    color: colors.sub,
  },
  extratoValor: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.ink,
  },
  extratoValorEntrada: {
    color: colors.greenDark,
  },
});
