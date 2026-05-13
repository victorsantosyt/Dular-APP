import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppIcon, DEmptyState, DErrorState, DLoadingState, DScreen } from "@/components/ui";
import {
  cancelarServicoMontador,
  finalizarServicoMontador,
  iniciarServicoMontador,
  type MontadorServico,
} from "@/api/montadorApi";
import { useMontadorServicos } from "@/hooks/useMontadorServicos";
import { useProfileTheme } from "@/hooks/useProfileTheme";
import type { MontadorTabParamList } from "@/navigation/MontadorNavigator";
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
  onCancelar: () => void;
  onReagendar: () => void;
}) {
  const status = upperStatus(servico.status);
  const canStart = status === "ACEITO" || status === "CONFIRMADO";
  const canFinish = status === "EM_ANDAMENTO";

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

      <View style={styles.actions}>
        <Pressable onPress={onDetalhe} style={[styles.actionButton, { backgroundColor: soft }]}>
          <Text style={[styles.actionText, { color: accent }]}>Ver detalhes</Text>
        </Pressable>
        {canStart ? (
          <Pressable onPress={onIniciar} disabled={actionLoading === servico.id} style={[styles.actionButton, { backgroundColor: accent }]}>
            <Text style={[styles.actionText, { color: colors.white }]}>{actionLoading === servico.id ? "Iniciando" : "Iniciar"}</Text>
          </Pressable>
        ) : null}
        {canFinish ? (
          <Pressable onPress={onFinalizar} disabled={actionLoading === servico.id} style={[styles.actionButton, { backgroundColor: accent }]}>
            <Text style={[styles.actionText, { color: colors.white }]}>{actionLoading === servico.id ? "Finalizando" : "Finalizar"}</Text>
          </Pressable>
        ) : null}
        {!isDone(servico) ? (
          <>
            <Pressable onPress={onReagendar} style={styles.ghostButton}>
              <Text style={styles.ghostText}>Reagendar</Text>
            </Pressable>
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
  const cancelarServico = (servicoId: string) => {
    Alert.alert("Cancelar serviço", "Confirma o cancelamento deste serviço?", [
      { text: "Voltar", style: "cancel" },
      {
        text: "Cancelar serviço",
        style: "destructive",
        onPress: async () => {
          try {
            setActionLoading(servicoId);
            await cancelarServicoMontador(servicoId);
            reload();
          } catch {
            Alert.alert("Erro", "Não foi possível cancelar o serviço.");
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  };
  const reagendarServico = () => {
    Alert.alert("Reagendamento", "Reagendamento será conectado quando o endpoint estiver disponível.");
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
              onCancelar={() => cancelarServico(item.id)}
              onReagendar={reagendarServico}
            />
          ))}
        </View>
      )}
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
});
