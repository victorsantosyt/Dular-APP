import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/lib/api";
import type { ServicoListItem as Servico } from "../../../../shared/types/servico";
import {
  cancelarServicoEmpregador,
  confirmarFinalizacaoEmpregador,
} from "@/api/empregadorApi";
import { DButton } from "@/components/DButton";
import { DularBadge } from "@/components/DularBadge";
import { MotivoModal } from "@/components/MotivoModal";
import { AvaliacaoModal } from "@/components/ui";
import { formatPrice } from "@/utils/formatPrice";
import { isStatusEncerrado } from "@/utils/servicoStatus";
import { EMPREGADOR_STACK_ROUTES } from "@/navigation/routes";
import { colors, radius, shadow, spacing, typography } from "@/theme/tokens";

const formatDate = (v: string | number | Date) => new Date(v).toLocaleDateString("pt-BR");
const statusUp = (s: any) => String(s ?? "").toUpperCase();
const FINAL = ["CONFIRMADO", "FINALIZADO", "FINALIZADO_CLIENTE", "PAGO", "AVALIADO"];
const POLL_MS = 5000;

function statusLabel(st: string) {
  const s = statusUp(st);
  if (s === "PENDENTE" || s === "SOLICITADO") return "Aguardando aceite";
  if (s === "ACEITO")       return "Aceito";
  if (s === "INICIADO" || s === "EM_ANDAMENTO") return "Em andamento";
  if (s === "AGUARDANDO_FINALIZACAO") return "Aguardando confirmação";
  if (["CONCLUIDO", "CONCLUÍDO"].includes(s)) return "Concluído";
  if (s === "CONFIRMADO")   return "Confirmado";
  if (s === "FINALIZADO")   return "Finalizado";
  if (s === "CANCELADO")    return "Cancelado";
  if (s === "RECUSADO")     return "Recusado";
  return st || "Status";
}

function statusVariant(st: string): "success" | "warning" | "neutral" | "danger" {
  const s = statusUp(st);
  if (["CONFIRMADO", "FINALIZADO"].includes(s))              return "success";
  if (["CONCLUIDO", "CONCLUÍDO"].includes(s))                return "warning";
  if (["ACEITO", "INICIADO", "EM_ANDAMENTO"].includes(s))    return "warning";
  if (["CANCELADO", "RECUSADO"].includes(s))                 return "danger";
  return "neutral";
}

export default function EmpregadorDetalhe({ route, navigation }: any) {
  const params = route.params as any;
  const servicoId: string = params.servicoId ?? params.servico?.id ?? "";

  const [svc, setSvc] = useState<Servico | null>(params.servico ?? null);
  const [loadingInit, setLoadingInit] = useState(!params.servico);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [avaliacaoVisible, setAvaliacaoVisible] = useState(false);
  const [motivoVisible, setMotivoVisible] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const busyRef = useRef(false);

  const fetchAtual = useCallback(async (silent = true) => {
    try {
      if (!silent) setRefreshing(true);
      const res = await api.get("/api/servicos/minhas");
      const found = Array.isArray(res.data?.servicos)
        ? res.data.servicos.find((s: Servico) => s.id === servicoId)
        : null;
      if (found) setSvc(found);
    } catch { /* silencioso */ } finally {
      if (!silent) setRefreshing(false);
    }
  }, [servicoId]);

  useEffect(() => {
    if (!params.servico && servicoId) {
      setLoadingInit(true);
      fetchAtual(true).finally(() => setLoadingInit(false));
    }
  }, [params.servico, servicoId, fetchAtual]);

  useEffect(() => { fetchAtual(); }, [fetchAtual]);

  useFocusEffect(useCallback(() => {
    fetchAtual();
    const t = setInterval(() => fetchAtual(), POLL_MS);
    return () => clearInterval(t);
  }, [fetchAtual]));

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const statusRaw = useMemo(() => statusUp(svc?.status), [svc?.status]);
  const isFinal = useMemo(() => FINAL.includes(statusRaw), [statusRaw]);
  const alreadyConfirmed = useMemo(
    () => Boolean((svc as any)?.__confirmedByClient || isFinal),
    [svc, isFinal]
  );
  const alreadyRated = useMemo(
    () => Boolean(
      (svc as any)?.__ratedByClient || (svc as any)?.avaliacaoCliente ||
      (svc as any)?.notaCliente || statusRaw === "AVALIADO"
    ),
    [svc, statusRaw]
  );
  const podeConfirmar = useMemo(
    () => !alreadyConfirmed && ["CONCLUIDO", "CONCLUÍDO", "AGUARDANDO_FINALIZACAO"].includes(statusRaw),
    [alreadyConfirmed, statusRaw]
  );
  const aguardandoOutraParte = useMemo(
    () => statusRaw === "AGUARDANDO_FINALIZACAO",
    [statusRaw]
  );
  const finalizarPeloEmpregador = useMemo(
    () => statusRaw === "EM_ANDAMENTO",
    [statusRaw]
  );
  const podeCancelar = useMemo(
    () =>
      !isStatusEncerrado(statusRaw) &&
      ["PENDENTE", "SOLICITADO", "ACEITO"].includes(statusRaw),
    [statusRaw]
  );
  const podeAvaliar = useMemo(
    () =>
      !alreadyRated &&
      ["CONFIRMADO", "FINALIZADO"].includes(statusRaw),
    [alreadyRated, statusRaw]
  );
  const chatLiberado = useMemo(
    () => ["ACEITO", "INICIADO", "EM_ANDAMENTO"].includes(statusRaw),
    [statusRaw]
  );

  const onConfirmar = useCallback(async () => {
    if (confirming || busyRef.current || !svc) return;
    busyRef.current = true;
    setConfirming(true);
    try {
      await confirmarFinalizacaoEmpregador(svc.id);
      setSvc((cur) => cur ? { ...cur, status: "CONFIRMADO" as any, __confirmedByClient: true } : cur);
      setToast("Serviço confirmado com sucesso.");
    } catch (e: any) {
      setToast(e?.response?.data?.error ?? "Falha ao confirmar serviço.");
    } finally {
      setConfirming(false);
      busyRef.current = false;
    }
  }, [confirming, svc]);

  const onCancelarComMotivo = useCallback(
    async (motivo: string, observacao: string) => {
      if (!svc || busyRef.current) return;
      busyRef.current = true;
      setCancelling(true);
      try {
        await cancelarServicoEmpregador(svc.id, motivo, observacao || undefined);
        setSvc((cur) => (cur ? { ...cur, status: "CANCELADO" as any } : cur));
        setMotivoVisible(false);
        setToast("Serviço cancelado.");
      } catch (e: any) {
        setToast(e?.response?.data?.error ?? "Falha ao cancelar.");
      } finally {
        setCancelling(false);
        busyRef.current = false;
      }
    },
    [svc]
  );

  if (loadingInit || !svc) {
    return (
      <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
        <Text style={s.loading}>Carregando...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchAtual(false)} />}
        showsVerticalScrollIndicator={false}
      >
        {toast ? (
          <View style={s.toast}><Text style={s.toastText}>{toast}</Text></View>
        ) : null}

        {/* Título + status */}
        <View style={s.titleRow}>
          <Text style={s.title}>Serviço #{svc.id.slice(0, 6).toUpperCase()}</Text>
          <DularBadge text={statusLabel(svc.status)} variant={statusVariant(svc.status)} />
        </View>

        {/* Info card */}
        <View style={s.card}>
          <View style={s.infoRow}>
            <Ionicons name="location-outline" size={15} color={colors.green} />
            <Text style={s.infoText}>{svc.bairro} — {svc.cidade}/{svc.uf}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.infoRow}>
            <Ionicons name="cash-outline" size={15} color={colors.green} />
            <Text style={[s.infoText, { fontWeight: "700", color: colors.greenDark }]}>
              {formatPrice(svc.precoFinal)}
            </Text>
          </View>
          <View style={s.divider} />
          <View style={s.infoRow}>
            <Ionicons name="person-outline" size={15} color={colors.green} />
            <Text style={s.infoText}>Diarista: {svc.diarista?.nome ?? "Pendente"}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.infoRow}>
            <Ionicons name="calendar-outline" size={15} color={colors.green} />
            <Text style={s.infoText}>Criado em {formatDate(svc.createdAt)}</Text>
          </View>
        </View>

        {/* Status CTA cards */}
        {["PENDENTE", "SOLICITADO"].includes(statusRaw) ? (
          <View style={s.infoBar}>
            <Ionicons name="time-outline" size={16} color={colors.primary} />
            <Text style={s.infoBarText}>Aguardando a diarista aceitar sua solicitação.</Text>
          </View>
        ) : null}

        {statusRaw === "ACEITO" ? (
          <View style={s.infoBar}>
            <Ionicons name="checkmark-circle-outline" size={16} color={colors.primary} />
            <Text style={s.infoBarText}>Sua solicitação foi aceita. A diarista está a caminho.</Text>
          </View>
        ) : null}

        {["INICIADO", "EM_ANDAMENTO"].includes(statusRaw) ? (
          <View style={[s.infoBar, { backgroundColor: colors.warningSoft }]}>
            <Ionicons name="time" size={16} color={colors.warning} />
            <Text style={[s.infoBarText, { color: colors.ink }]}>
              Serviço em andamento. Aguarde a conclusão para confirmar.
            </Text>
          </View>
        ) : null}

        {aguardandoOutraParte ? (
          <View style={[s.infoBar, { backgroundColor: colors.warningSoft }]}>
            <Ionicons name="hourglass-outline" size={16} color={colors.warning} />
            <Text style={[s.infoBarText, { color: colors.ink }]}>
              Aguardando confirmação da outra parte.
            </Text>
          </View>
        ) : null}

        {statusRaw === "CONFIRMADO" ? (
          <View style={s.successBar}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={s.successBarText}>Pagamento liberado ✓</Text>
          </View>
        ) : null}

        {["CANCELADO", "RECUSADO"].includes(statusRaw) ? (
          <View style={[s.infoBar, { backgroundColor: colors.dangerSoft }]}>
            <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
            <Text style={[s.infoBarText, { color: colors.danger }]}>
              {statusRaw === "CANCELADO" ? "Serviço cancelado." : "Serviço recusado."}
            </Text>
          </View>
        ) : null}

        {/* Chat */}
        {chatLiberado ? (
          <DButton
            title="Abrir chat"
            variant="outline"
            onPress={() => navigation.navigate(EMPREGADOR_STACK_ROUTES.CHAT, { servicoId: svc.id })}
          />
        ) : null}

        {/* Confirmar finalização */}
        {podeConfirmar || finalizarPeloEmpregador ? (
          <DButton
            title={confirming ? "Confirmando..." : "Confirmar finalização"}
            onPress={onConfirmar}
            loading={confirming}
            disabled={confirming}
          />
        ) : null}

        {/* Avaliar */}
        {podeAvaliar ? (
          <DButton
            title="Avaliar serviço"
            onPress={() => setAvaliacaoVisible(true)}
          />
        ) : null}

        {/* Já avaliado */}
        {!podeAvaliar && alreadyRated ? (
          <View style={s.doneCard}>
            <Ionicons name="star" size={18} color={colors.star} />
            <Text style={s.doneText}>Você já avaliou este serviço. Obrigado!</Text>
          </View>
        ) : null}

        {/* Cancelar */}
        {podeCancelar ? (
          <Pressable
            onPress={() => setMotivoVisible(true)}
            disabled={cancelling}
            style={({ pressed }) => [s.cancelBtn, pressed && { opacity: 0.75 }]}
          >
            <Text style={s.cancelText}>{cancelling ? "Cancelando..." : "Cancelar serviço"}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <MotivoModal
        visible={motivoVisible}
        title="Cancelar serviço"
        confirmLabel="Cancelar serviço"
        onClose={() => setMotivoVisible(false)}
        onConfirm={onCancelarComMotivo}
      />

      <AvaliacaoModal
        visible={avaliacaoVisible}
        servicoId={svc.id}
        nomeAvaliado={svc.diarista?.nome ?? "Diarista"}
        onClose={() => setAvaliacaoVisible(false)}
        onSucesso={() => {
          setAvaliacaoVisible(false);
          setSvc((cur) => cur ? { ...cur, __ratedByClient: true } as any : cur);
          setToast("Avaliação enviada. Obrigado!");
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bg },
  scroll:  { padding: spacing.screenPadding, gap: 12, paddingBottom: 48 },
  loading: { ...typography.sub, textAlign: "center", marginTop: 48 },

  toast: {
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.ink,
  },
  toastText: { color: colors.white, fontWeight: "700", fontSize: 13 },

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
    gap: 9,
    ...shadow.card,
  },
  infoRow:  { flexDirection: "row", alignItems: "center", gap: 8 },
  infoText: { fontSize: 13, fontWeight: "500", color: colors.ink, flex: 1 },
  divider:  { height: 1, backgroundColor: colors.stroke },

  infoBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.lavenderSoft,
  },
  infoBarText: { fontSize: 12, fontWeight: "500", color: colors.ink, flex: 1 },

  successBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.successSoft,
  },
  successBarText: { fontSize: 12, fontWeight: "700", color: colors.success, flex: 1 },

  doneCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.greenLight,
    borderWidth: 1,
    borderColor: colors.stroke,
  },
  doneText: { fontSize: 12, fontWeight: "700", color: colors.greenDark },

  cancelBtn: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.btn,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700",
  },
});
