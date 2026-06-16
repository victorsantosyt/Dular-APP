import React, { useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppIcon, DEmptyState, DErrorState, DLoadingState, DScreen } from "@/components/ui";
import {
  cancelarServicoMontador,
  confirmarFinalizacaoMontador,
  finalizarServicoMontador,
  iniciarServicoMontador,
  proporReagendamento,
  type MontadorServico,
} from "@/api/montadorApi";
import { MotivoModal } from "@/components/MotivoModal";
import { useMontadorServicos } from "@/hooks/useMontadorServicos";
import { useProfileTheme } from "@/hooks/useProfileTheme";
import type { MontadorTabParamList } from "@/navigation/MontadorNavigator";
import { isStatusEncerrado } from "@/utils/servicoStatus";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import {
  formatDateTime,
  labelServico,
  localResumo,
  statusLabel,
  upperStatus,
} from "./montadorUtils";

type Navigation = BottomTabNavigationProp<MontadorTabParamList>;
type Filtro = "hoje" | "amanha" | "semana" | "mes" | "concluidos";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "hoje", label: "Hoje" },
  { id: "amanha", label: "Amanhã" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mês" },
  { id: "concluidos", label: "Concluídos" },
];

function dayDiff(value?: string | Date | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const other = new Date(date);
  other.setHours(0, 0, 0, 0);
  return Math.round((other.getTime() - start.getTime()) / 86_400_000);
}

function isDone(servico: MontadorServico) {
  return ["FINALIZADO", "CONCLUIDO"].includes(upperStatus(servico.status));
}

function fmtReagendamento(servico: MontadorServico) {
  const d = servico.reagendamentoData ? new Date(servico.reagendamentoData) : null;
  const dataLabel =
    d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—";
  const t = upperStatus(servico.reagendamentoTurno);
  const turnoLabel = t === "MANHA" ? "Manhã" : t === "TARDE" ? "Tarde" : "";
  return `${dataLabel}${turnoLabel ? " · " + turnoLabel : ""}`;
}

function FilterChip({
  label,
  active,
  accent,
  soft,
  onPress,
}: {
  label: string;
  active: boolean;
  accent: string;
  soft: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterChip,
        active
          ? { backgroundColor: accent, borderColor: accent }
          : { backgroundColor: colors.surface, borderColor: soft },
      ]}
    >
      <Text style={[styles.filterLabel, { color: active ? colors.white : colors.textSecondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function AgendaCard({
  servico,
  accent,
  soft,
  actionLoading,
  onDetalhe,
  onIniciar,
  onFinalizar,
  onConfirmarFinalizacao,
  onCancelar,
  onReagendar,
}: {
  servico: MontadorServico;
  accent: string;
  soft: string;
  actionLoading: string | null;
  onDetalhe: () => void;
  onIniciar: () => void;
  onFinalizar: () => void;
  onConfirmarFinalizacao: () => void;
  onCancelar: () => void;
  onReagendar: () => void;
}) {
  const status = upperStatus(servico.status);
  const encerrado = isStatusEncerrado(status);
  const canStart = !encerrado && status === "ACEITO";
  const canFinish = !encerrado && status === "EM_ANDAMENTO";
  const aguardandoOutra = status === "AGUARDANDO_FINALIZACAO";
  const isCanceladoOuRecusado = status === "CANCELADO" || status === "RECUSADO";
  const reagendamentoPendente = !!servico.reagendamentoData;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIcon, { backgroundColor: soft }]}>
          <AppIcon name="CalendarCheck" size={20} color={accent} />
        </View>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.cardTitle}>{labelServico(servico)}</Text>
          <Text style={styles.cardSub}>{formatDateTime(servico)}</Text>
        </View>
        <View style={[styles.statusPill, { borderColor: accent, backgroundColor: soft }]}>
          <Text style={[styles.statusText, { color: accent }]}>{statusLabel(servico.status)}</Text>
        </View>
      </View>

      <View style={styles.infoRow}>
        <AppIcon name="MapPin" size={15} color={colors.textSecondary} />
        <Text style={styles.infoText}>{localResumo(servico, true)}</Text>
      </View>
      <View style={styles.infoRow}>
        <AppIcon name="User" size={15} color={colors.textSecondary} />
        <Text style={styles.infoText}>{servico.empregador?.nome ?? "Empregador não informado"}</Text>
      </View>

      {aguardandoOutra ? (
        <View style={styles.infoRow}>
          <AppIcon name="Hourglass" size={15} color={colors.warning} />
          <Text style={[styles.infoText, { color: colors.warning }]}>
            Aguardando confirmação da outra parte.
          </Text>
        </View>
      ) : null}

      {reagendamentoPendente ? (
        <View style={styles.infoRow}>
          <AppIcon name="Clock" size={15} color={colors.warning} />
          <Text style={[styles.infoText, { color: colors.warning }]}>
            Reagendamento proposto p/ {fmtReagendamento(servico)} — aguardando o empregador.
          </Text>
        </View>
      ) : null}

      {isCanceladoOuRecusado ? (
        <View style={styles.infoRow}>
          <AppIcon name="XCircle" size={15} color={colors.danger} />
          <Text style={[styles.infoText, { color: colors.danger }]}>
            {status === "CANCELADO" ? "Serviço cancelado." : "Serviço recusado."}
          </Text>
        </View>
      ) : null}

      {encerrado && !isCanceladoOuRecusado ? (
        <View style={styles.infoRow}>
          <AppIcon name="CheckCircle" size={15} color={colors.success} />
          <Text style={[styles.infoText, { color: colors.success }]}>
            Serviço finalizado.
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable onPress={onDetalhe} style={[styles.actionButton, { backgroundColor: soft }]}>
          <Text style={[styles.actionText, { color: accent }]}>Ver detalhes</Text>
        </Pressable>
        {canStart ? (
          <Pressable onPress={onIniciar} disabled={actionLoading === servico.id} style={[styles.actionButton, { backgroundColor: accent }]}>
            <Text style={[styles.actionText, { color: colors.white }]}>{actionLoading === servico.id ? "Iniciando" : "Iniciar serviço"}</Text>
          </Pressable>
        ) : null}
        {canFinish ? (
          <Pressable onPress={onConfirmarFinalizacao} disabled={actionLoading === servico.id} style={[styles.actionButton, { backgroundColor: accent }]}>
            <Text style={[styles.actionText, { color: colors.white }]}>
              {actionLoading === servico.id ? "Finalizando" : "Confirmar finalização"}
            </Text>
          </Pressable>
        ) : null}
        {!encerrado && !aguardandoOutra ? (
          <>
            {!reagendamentoPendente ? (
              <Pressable onPress={onReagendar} style={styles.ghostButton}>
                <Text style={styles.ghostText}>Reagendar</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={onCancelar} style={styles.ghostButton}>
              <Text style={[styles.ghostText, { color: colors.danger }]}>Cancelar</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}

export default function MontadorAgenda() {
  const navigation = useNavigation<Navigation>();
  const profileTheme = useProfileTheme("MONTADOR");
  const { agenda, loading, refreshing, error, refetch, reload } = useMontadorServicos();
  const [filtro, setFiltro] = useState<Filtro>("hoje");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    if (filtro === "concluidos") return agenda.filter(isDone);
    return agenda.filter((item) => {
      const diff = dayDiff(item.data);
      if (diff == null) return filtro === "mes";
      if (filtro === "hoje") return diff === 0;
      if (filtro === "amanha") return diff === 1;
      if (filtro === "semana") return diff >= 0 && diff <= 7;
      return diff >= 0 && diff <= 31;
    });
  }, [agenda, filtro]);

  const abrirDetalheAgendamento = (servicoId: string) => navigation.navigate("MontadorDetalheServico", { servicoId });
  const iniciarServico = async (servicoId: string) => {
    try {
      setActionLoading(servicoId);
      await iniciarServicoMontador(servicoId);
      reload();
    } catch {
      Alert.alert("Erro", "Não foi possível iniciar o serviço.");
    } finally {
      setActionLoading(null);
    }
  };
  const finalizarServico = async (servicoId: string) => {
    try {
      setActionLoading(servicoId);
      await finalizarServicoMontador(servicoId);
      reload();
    } catch {
      Alert.alert("Erro", "Não foi possível finalizar o serviço.");
    } finally {
      setActionLoading(null);
    }
  };
  const confirmarFinalizacao = async (servicoId: string) => {
    try {
      setActionLoading(servicoId);
      await confirmarFinalizacaoMontador(servicoId);
      reload();
    } catch {
      // Fallback: backend pode ainda usar /concluir
      try {
        await finalizarServicoMontador(servicoId);
        reload();
      } catch {
        Alert.alert("Erro", "Não foi possível confirmar a finalização.");
      }
    } finally {
      setActionLoading(null);
    }
  };
  const cancelarServico = (servicoId: string) => {
    setCancelTargetId(servicoId);
  };
  const confirmarCancelamento = async (motivo: string, observacao: string) => {
    if (!cancelTargetId) return;
    try {
      setActionLoading(cancelTargetId);
      await cancelarServicoMontador(cancelTargetId, motivo, observacao || undefined);
      setCancelTargetId(null);
      reload();
    } catch {
      Alert.alert("Erro", "Não foi possível cancelar o serviço.");
    } finally {
      setActionLoading(null);
    }
  };
  const [reagTarget, setReagTarget] = useState<MontadorServico | null>(null);
  const [reagData, setReagData] = useState<Date | null>(null);
  const [reagTurno, setReagTurno] = useState<"MANHA" | "TARDE">("MANHA");
  const [reagSaving, setReagSaving] = useState(false);

  const proximosDias = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i + 1);
      return d;
    });
  }, []);

  const abrirReagendar = (servico: MontadorServico) => {
    setReagTarget(servico);
    setReagData(null);
    setReagTurno("MANHA");
  };

  const confirmarReagendamento = async () => {
    if (!reagTarget || !reagData || reagSaving) return;
    try {
      setReagSaving(true);
      await proporReagendamento(reagTarget.id, reagData.toISOString(), reagTurno);
      setReagTarget(null);
      reload();
      Alert.alert("Proposta enviada", "O empregador vai confirmar ou recusar a nova data.");
    } catch {
      Alert.alert("Erro", "Não foi possível enviar a proposta de reagendamento.");
    } finally {
      setReagSaving(false);
    }
  };

  return (
    <DScreen
      scroll
      withBottomPadding
      backgroundColor={profileTheme.background}
      refreshing={refreshing}
      refreshTintColor={profileTheme.primary}
      onRefresh={refetch}
      contentContainerStyle={styles.scroll}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Agenda</Text>
        <Text style={styles.subtitle}>Serviços aceitos e agendados</Text>
      </View>

      <View style={styles.filters}>
        {FILTROS.map((item) => (
          <FilterChip
            key={item.id}
            label={item.label}
            active={filtro === item.id}
            accent={profileTheme.primary}
            soft={profileTheme.primarySoft}
            onPress={() => setFiltro(item.id)}
          />
        ))}
      </View>

      {loading ? (
        <DLoadingState text="Carregando agenda" color={profileTheme.primary} />
      ) : error ? (
        <DErrorState message={error} onRetry={reload} />
      ) : filtrados.length === 0 ? (
        <DEmptyState
          icon="Calendar"
          title="Nenhum serviço neste período"
          subtitle="Serviços aceitos pelo montador aparecerão aqui."
          accentColor={profileTheme.primary}
          softBg={profileTheme.primarySoft}
        />
      ) : (
        <View style={styles.list}>
          {filtrados.map((item) => (
            <AgendaCard
              key={item.id}
              servico={item}
              accent={profileTheme.primary}
              soft={profileTheme.primarySoft}
              actionLoading={actionLoading}
              onDetalhe={() => abrirDetalheAgendamento(item.id)}
              onIniciar={() => iniciarServico(item.id)}
              onFinalizar={() => finalizarServico(item.id)}
              onConfirmarFinalizacao={() => confirmarFinalizacao(item.id)}
              onCancelar={() => cancelarServico(item.id)}
              onReagendar={() => abrirReagendar(item)}
            />
          ))}
        </View>
      )}
      <MotivoModal
        visible={!!cancelTargetId}
        title="Cancelar serviço"
        confirmLabel="Cancelar serviço"
        onClose={() => setCancelTargetId(null)}
        onConfirm={confirmarCancelamento}
      />

      <Modal visible={!!reagTarget} transparent animationType="fade" onRequestClose={() => setReagTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reagendar serviço</Text>
            <Text style={styles.modalSub}>Escolha a nova data e o turno. O empregador precisa confirmar.</Text>

            <Text style={styles.modalLabel}>Nova data</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
              {proximosDias.map((d) => {
                const selected = reagData?.toDateString() === d.toDateString();
                return (
                  <Pressable
                    key={d.toISOString()}
                    onPress={() => setReagData(d)}
                    style={[
                      styles.dayChip,
                      selected
                        ? { backgroundColor: profileTheme.primary, borderColor: profileTheme.primary }
                        : { borderColor: profileTheme.border },
                    ]}
                  >
                    <Text style={[styles.dayChipText, selected && { color: colors.white }]}>
                      {d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={styles.modalLabel}>Turno</Text>
            <View style={styles.turnoRow}>
              {(["MANHA", "TARDE"] as const).map((t) => {
                const selected = reagTurno === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setReagTurno(t)}
                    style={[
                      styles.turnoChip,
                      selected
                        ? { backgroundColor: profileTheme.primary, borderColor: profileTheme.primary }
                        : { borderColor: profileTheme.border },
                    ]}
                  >
                    <Text style={[styles.turnoChipText, selected && { color: colors.white }]}>
                      {t === "MANHA" ? "Manhã" : "Tarde"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <Pressable onPress={() => setReagTarget(null)} style={[styles.modalBtn, styles.modalBtnGhost]}>
                <Text style={styles.modalBtnGhostText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={confirmarReagendamento}
                disabled={!reagData || reagSaving}
                style={[styles.modalBtn, { backgroundColor: profileTheme.primary }, (!reagData || reagSaving) && { opacity: 0.6 }]}
              >
                <Text style={styles.modalBtnText}>{reagSaving ? "Enviando…" : "Propor"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </DScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: 16,
  },
  header: {
    gap: 4,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "700",
    letterSpacing: 0,
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterLabel: {
    ...typography.caption,
    fontWeight: "700",
  },
  list: {
    gap: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    ...typography.bodySm,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  cardSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusPill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    ...typography.caption,
    fontWeight: "700",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoText: {
    flex: 1,
    ...typography.bodySm,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionButton: {
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionText: {
    ...typography.caption,
    fontWeight: "700",
  },
  ghostButton: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.surfaceAlt,
  },
  ghostText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: colors.overlay,
  },
  modalCard: {
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: 18,
    gap: 12,
    ...shadows.floating,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "700",
  },
  modalSub: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  modalLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "800",
    marginTop: 4,
  },
  dayRow: {
    gap: 8,
    paddingVertical: 2,
  },
  dayChip: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  dayChipText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  turnoRow: {
    flexDirection: "row",
    gap: 8,
  },
  turnoChip: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  turnoChipText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  modalBtn: {
    flex: 1,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnGhost: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalBtnGhostText: {
    ...typography.bodySmMedium,
    color: colors.textSecondary,
    fontWeight: "800",
  },
  modalBtnText: {
    ...typography.bodySmMedium,
    color: colors.white,
    fontWeight: "800",
  },
});
