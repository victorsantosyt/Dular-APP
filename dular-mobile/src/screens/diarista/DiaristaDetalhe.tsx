/**
 * DiaristaDetalhe — Detalhe de serviço para a diarista
 *
 * Identidade visual 100% aplicada com tokens Dular validados.
 * Lógica de ações (aceitar/iniciar/concluir) preservada.
 */

import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/lib/api";
import { Servico } from "@/types/servico";
import { DButton } from "@/components/DButton";
import { DularBadge } from "@/components/DularBadge";

// ── Tokens ──────────────────────────────────────────────────────────────────
import { colors, radius, shadow, spacing, typography } from "@/theme/tokens";

// ── Helpers ──────────────────────────────────────────────────────────────────

const brl = (v: number) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function statusVariant(st: string): "success" | "warning" | "neutral" | "danger" {
  const s = (st || "").toUpperCase();
  if (["FINALIZADO", "CONCLUIDO", "CONCLUÍDO", "CONFIRMADO"].includes(s)) return "success";
  if (["ACEITO", "EM_ANDAMENTO"].includes(s)) return "warning";
  if (["CANCELADO", "CANCELADA", "RECUSADO"].includes(s)) return "danger";
  return "neutral";
}

function statusLabel(st: string) {
  const s = (st || "").toUpperCase();
  if (s === "SOLICITADO")   return "Aguardando aceite";
  if (s === "ACEITO")       return "Aceito";
  if (s === "EM_ANDAMENTO") return "Em andamento";
  if (s === "CONCLUIDO" || s === "CONCLUÍDO") return "Concluído";
  if (s === "CONFIRMADO")   return "Confirmado";
  if (s === "FINALIZADO")   return "Finalizado";
  return st || "Status";
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function DiaristaDetalhe({ route, navigation }: any) {
  const { servico }   = route.params as { servico: Servico };
  const [svc, setSvc] = useState<Servico>(servico);
  const [loading, setLoading] = useState(false);

  async function reloadFromList() {
    try {
      const res   = await api.get("/api/servicos/minhas");
      const found = res.data?.servicos?.find((s: Servico) => s.id === svc.id);
      if (found) setSvc(found);
    } catch { /* silencioso */ }
  }

  async function action(name: string, body?: unknown) {
    try {
      setLoading(true);
      const res     = await api.post(`/api/servicos/${svc.id}/${name}`, body ?? {});
      const updated = res.data?.servico ?? res.data;
      if (updated?.id) setSvc(updated);
      else await reloadFromList();
      Alert.alert("Sucesso", `Ação "${name}" executada com sucesso.`);
      navigation.goBack();
    } catch (e: any) {
      Alert.alert("Erro", e?.response?.data?.error ?? e?.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right", "bottom"]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Título + status ── */}
        <View style={s.titleRow}>
          <Text style={s.title}>Serviço #{svc.id.slice(0, 6).toUpperCase()}</Text>
          <DularBadge text={statusLabel(svc.status)} variant={statusVariant(svc.status)} />
        </View>

        {/* ── Info card ── */}
        <View style={s.card}>
          <InfoRow icon="location-outline" label="Local">
            <Text style={s.infoValue}>{svc.bairro} — {svc.cidade}/{svc.uf}</Text>
          </InfoRow>

          <View style={s.divider} />

          <InfoRow icon="cash-outline" label="Valor">
            <Text style={[s.infoValue, { color: colors.greenDark, fontWeight: "800" }]}>
              {brl(svc.precoFinal / 100)}
            </Text>
          </InfoRow>

          <View style={s.divider} />

          <InfoRow icon="person-outline" label="Cliente">
            <Text style={s.infoValue}>{svc.cliente?.nome ?? "—"}</Text>
          </InfoRow>

          {/* Endereço — só visível após aceite */}
          {svc.status === "SOLICITADO" ? (
            <>
              <View style={s.divider} />
              <View style={s.addressHint}>
                <Ionicons name="lock-closed" size={14} color={colors.sub} />
                <Text style={s.addressHintText}>
                  Endereço completo liberado após aceitar o serviço.
                </Text>
              </View>
            </>
          ) : svc.enderecoCompleto ? (
            <>
              <View style={s.divider} />
              <InfoRow icon="home-outline" label="Endereço">
                <Text style={s.infoValue}>{svc.enderecoCompleto}</Text>
              </InfoRow>
            </>
          ) : null}
        </View>

        {/* ── CTAs ── */}
        <View style={s.ctaBlock}>
          {svc.status === "SOLICITADO" && (
            <DButton
              title="Aceitar serviço"
              loading={loading}
              onPress={() => action("aceitar", { enderecoCompleto: "Rua X, 123 - Centro" })}
            />
          )}
          {svc.status === "ACEITO" && (
            <DButton
              title="Iniciar serviço"
              loading={loading}
              onPress={() => action("iniciar")}
            />
          )}
          {svc.status === "EM_ANDAMENTO" && (
            <DButton
              title="Concluir serviço"
              loading={loading}
              onPress={() => action("concluir")}
            />
          )}
          {["CONCLUIDO","CONCLUÍDO","CONFIRMADO","FINALIZADO"].includes(svc.status.toUpperCase()) && (
            <View style={s.doneCard}>
              <Ionicons name="checkmark-circle" size={24} color={colors.green} />
              <Text style={s.doneText}>Serviço finalizado. Obrigada!</Text>
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── InfoRow helper ─────────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={ir.row}>
      <View style={ir.iconWrap}>
        <Ionicons name={icon} size={16} color={colors.green} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ir.label}>{label}</Text>
        {children}
      </View>
    </View>
  );
}

const ir = StyleSheet.create({
  row:     { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  iconWrap:{
    width: 32, height: 32, borderRadius: radius.sm,
    backgroundColor: colors.greenLight,
    alignItems: "center", justifyContent: "center",
    marginTop: 2,
  },
  label: { ...typography.sub, marginBottom: 2 },
});

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: colors.bg },
  scroll: {
    padding: spacing.lg,
    paddingBottom: 40,
    gap: spacing.xl,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { ...typography.h1 },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stroke,
    padding: 14,
    gap: 12,
    ...shadow.card,
  },
  infoValue: { fontSize: 14, fontWeight: "600", color: colors.ink },
  divider:   { height: 1, backgroundColor: colors.stroke },

  addressHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.cardStrong,
  },
  addressHintText: { ...typography.sub, flex: 1 },

  ctaBlock: { gap: 10 },

  doneCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.greenLight,
    borderWidth: 1,
    borderColor: colors.green,
  },
  doneText: { fontSize: 14, fontWeight: "700", color: colors.greenDark },
});
