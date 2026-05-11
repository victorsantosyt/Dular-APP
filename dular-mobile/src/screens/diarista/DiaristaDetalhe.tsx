/**
 * DiaristaDetalhe — Detalhe de serviço para a diarista
 *
 * Identidade visual 100% aplicada com tokens Dular validados.
 * Lógica de ações (aceitar/iniciar/concluir) preservada.
 */

import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/lib/api";
import type { ServicoListItem as Servico } from "../../../../shared/types/servico";
import { DButton } from "@/components/DButton";
import { DularBadge } from "@/components/DularBadge";
import { SafeScoreBadge } from "@/components/SafeScoreBadge";
import { formatPrice } from "@/utils/formatPrice";
import { DIARISTA_STACK_ROUTES } from "@/navigation/routes";

// ── Tokens ──────────────────────────────────────────────────────────────────
import { colors, radius, shadow, spacing, typography } from "@/theme/tokens";

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function getServicoEndereco(servico: Servico | null | undefined) {
  const endereco = servico?.enderecoCompleto ?? null;
  return typeof endereco === "string" && endereco.trim() ? endereco.trim() : null;
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function DiaristaDetalhe({ route, navigation }: any) {
  const params = route.params as any;
  const [svc, setSvc] = useState<Servico | null>(params.servico ?? null);
  const [loadingInit, setLoadingInit] = useState(!params.servico);
  const servicoId: string = params.servicoId ?? params.servico?.id ?? "";
  const [loading, setLoading] = useState(false);
  const [clienteScore, setClienteScore] = useState<{
    faixa: string;
    cor: string;
    bloqueado: boolean;
    totalServicos: number;
    verificado: boolean;
  } | null>(null);

  async function reloadFromList() {
    try {
      const res   = await api.get("/api/servicos/minhas");
      const found = res.data?.servicos?.find((s: Servico) => s.id === servicoId);
      if (found) setSvc(found);
    } catch { /* silencioso */ }
  }

  useEffect(() => {
    if (!params.servico && servicoId) {
      setLoadingInit(true);
      reloadFromList().finally(() => setLoadingInit(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function action(name: string, body?: unknown) {
    if (!svc) return;
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

  function recusarServico() {
    if (!svc) return;
    Alert.alert(
      "Recusar serviço?",
      "Tem certeza que deseja recusar esta solicitação?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Recusar", style: "destructive", onPress: () => { void action("recusar"); } },
      ]
    );
  }

  useEffect(() => {
    if (!svc?.cliente?.id) return;
    let alive = true;
    api.get(`/api/usuarios/${svc.cliente.id}/score`)
      .then((res) => {
        if (alive) setClienteScore(res.data);
      })
      .catch(() => {
        if (alive) setClienteScore(null);
      });
    return () => {
      alive = false;
    };
  }, [svc?.cliente?.id]);

  function confirmarAceite() {
    const endereco = getServicoEndereco(svc);
    const body = endereco ? { enderecoCompleto: endereco } : {};

    if (!endereco) {
      Alert.alert(
        "Endereço não informado",
        "Endereço não informado pelo cliente. Confirma mesmo assim?",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Confirmar", onPress: () => { void action("aceitar", body); } },
        ]
      );
      return;
    }

    void action("aceitar", body);
  }

  function aceitarServico() {
    if (clienteScore?.bloqueado) {
      Alert.alert(
        "Atenção",
        "Atenção: este cliente está com restrições ativas. Deseja continuar?",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Continuar", onPress: confirmarAceite },
        ]
      );
      return;
    }

    confirmarAceite();
  }

  if (loadingInit || !svc) {
    return (
      <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
        <Text style={{ ...typography.sub, textAlign: "center", marginTop: 48 }}>Carregando...</Text>
      </SafeAreaView>
    );
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
            <Text style={[s.infoValue, { color: colors.greenDark, fontWeight: "700" }]}>
              {formatPrice(svc.precoFinal)}
            </Text>
          </InfoRow>

          <View style={s.divider} />

          <InfoRow icon="person-outline" label="Cliente">
            <Text style={s.infoValue}>{svc.cliente?.nome ?? "—"}</Text>
          </InfoRow>

          {clienteScore ? (
            <>
              <View style={s.divider} />
              <SafeScoreBadge {...clienteScore} />
              {clienteScore.bloqueado ? (
                <View style={s.restrictedBox}>
                  <Text style={s.restrictedText}>
                    Este usuário está com acesso restrito na plataforma
                  </Text>
                </View>
              ) : null}
            </>
          ) : null}

          {getServicoEndereco(svc) ? (
            <>
              <View style={s.divider} />
              <InfoRow icon="home-outline" label="Endereço">
                <Text style={s.infoValue}>{getServicoEndereco(svc)}</Text>
              </InfoRow>
            </>
          ) : svc.status === "SOLICITADO" ? (
            <>
              <View style={s.divider} />
              <View style={s.addressHint}>
                <Ionicons name="lock-closed" size={14} color={colors.sub} />
                <Text style={s.addressHintText}>
                  Endereço não informado pelo cliente.
                </Text>
              </View>
            </>
          ) : null}
        </View>

        {/* ── CTAs ── */}
        <View style={s.ctaBlock}>
          {svc.status === "SOLICITADO" && (
            <>
              <DButton
                title="Aceitar serviço"
                loading={loading}
                onPress={aceitarServico}
              />
              <DButton
                title="Recusar serviço"
                variant="outline"
                onPress={recusarServico}
              />
            </>
          )}
          {["ACEITO", "INICIADO", "EM_ANDAMENTO"].includes(svc.status.toUpperCase()) && (
            <DButton
              title="Abrir chat"
              variant="outline"
              onPress={() => navigation.navigate(DIARISTA_STACK_ROUTES.CHAT, { servicoId: svc.id })}
            />
          )}
          {svc.status === "ACEITO" && (
            <DButton
              title="Iniciar serviço"
              loading={loading}
              onPress={() => { void action("iniciar"); }}
            />
          )}
          {["INICIADO", "EM_ANDAMENTO"].includes(svc.status.toUpperCase()) && (
            <DButton
              title="Concluir serviço"
              loading={loading}
              onPress={() => { void action("concluir"); }}
            />
          )}
          {svc.status.toUpperCase() === "CONFIRMADO" && (
            <View style={s.paidCard}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={s.paidText}>Pagamento liberado ✓</Text>
            </View>
          )}
          {["CONCLUIDO","CONCLUÍDO","FINALIZADO"].includes(svc.status.toUpperCase()) && (
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
    padding: spacing.screenPadding,
    paddingBottom: 40,
    gap: 16,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "700",
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stroke,
    padding: 12,
    gap: 10,
    ...shadow.card,
  },
  infoValue: { fontSize: 13, fontWeight: "500", color: colors.ink },
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
  restrictedBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    backgroundColor: colors.dangerSoft,
    padding: 10,
  },
  restrictedText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },

  ctaBlock: { gap: 10 },

  paidCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.success,
  },
  paidText: { fontSize: 12, fontWeight: "700", color: colors.success },

  doneCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.greenLight,
    borderWidth: 1,
    borderColor: colors.green,
  },
  doneText: { fontSize: 12, fontWeight: "700", color: colors.greenDark },
});
