import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppIcon, DAvatar, DBadge, DButton, DCard } from "@/components/ui";
import { colors, radius, spacing, typography } from "@/theme";
import { useGenderTheme } from "@/hooks/useProfileTheme";
import type { ProfileTheme } from "@/theme/profileTheme";
import type { DiaristaTabParamList } from "@/navigation/DiaristaNavigator";
import { useAgendamentosDiarista } from "@/hooks/useAgendamentosDiarista";
import { aceitarServicoDiarista, concluirServicoDiarista } from "@/api/diaristaApi";
import { useMensagens } from "@/hooks/useMensagens";

type Navigation = BottomTabNavigationProp<DiaristaTabParamList>;
type Filtro = "hoje" | "amanha" | "semana" | "pendentes" | "confirmados" | "concluidos";
type StatusAgendamento =
  | "pendente"
  | "confirmado"
  | "andamento"
  | "aguardando"
  | "finalizado"
  | "cancelado";

type Agendamento = {
  id: string;
  nomeCliente: string;
  avaliacao: string;
  localizacao: string;
  servico: string;
  /** Categoria/subtipo bruto (ex.: FAXINA_PESADA) — define a intensidade. */
  categoria?: string | null;
  data: string;
  hora: string;
  preco: string;
  status: StatusAgendamento;
  avatarUrl?: string;
};

// Intensidade/subtipo legível para o card (FAXINA_PESADA → "Limpeza pesada").
const CATEGORIA_LABEL: Record<string, string> = {
  FAXINA_LEVE: "Limpeza leve",
  FAXINA_MEDIA: "Limpeza média",
  FAXINA_PESADA: "Limpeza pesada",
  FAXINA_COMPLETA: "Limpeza completa",
  BABA_DIURNA: "Babá diurna",
  BABA_NOTURNA: "Babá noturna",
  BABA_INTEGRAL: "Babá integral",
  COZINHEIRA_DIARIA: "Cozinha diária",
  COZINHEIRA_EVENTO: "Cozinha para evento",
  PASSA_ROUPA_BASICO: "Passar roupa — básico",
  PASSA_ROUPA_COMPLETO: "Passar roupa — completo",
};

/** Rótulo do serviço: a categoria/intensidade quando houver (ex.: "Limpeza
 *  pesada"), senão o tipo (ex.: "Limpeza"). */
function servicoCompleto(a: Agendamento): string {
  if (a.categoria && CATEGORIA_LABEL[a.categoria]) return CATEGORIA_LABEL[a.categoria];
  return a.servico;
}

const FILTROS: { label: string; value: Filtro }[] = [
  { label: "Hoje", value: "hoje" },
  { label: "Amanhã", value: "amanha" },
  { label: "Semana", value: "semana" },
  { label: "Pendentes", value: "pendentes" },
  { label: "Confirmados", value: "confirmados" },
  { label: "Concluídos", value: "concluidos" },
];

function FilterChip({
  label,
  active,
  accentColor,
  onPress,
}: {
  label: string;
  active: boolean;
  accentColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <View style={[styles.filterChip, active ? { backgroundColor: accentColor, borderColor: accentColor } : styles.filterChipIdle]}>
        <Text style={[styles.filterLabel, active ? styles.filterLabelActive : styles.filterLabelIdle]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function AgendaResumo({ total, accentColor, softBg }: { total: number; accentColor: string; softBg: string }) {
  return (
    <DCard style={styles.calendarCard}>
      <View style={styles.calendarHeader}>
        <View>
          <Text style={styles.calendarTitle}>Agenda</Text>
          <Text style={styles.calendarSummary}>
            {total === 1 ? "1 agendamento carregado" : `${total} agendamentos carregados`}
          </Text>
        </View>
        <View style={[styles.resumoIconBox, { backgroundColor: softBg }]}>
          <AppIcon name="Calendar" size={22} color={accentColor} strokeWidth={2.1} />
        </View>
      </View>
    </DCard>
  );
}

function statusCardStyle(status: StatusAgendamento, accentColor: string) {
  switch (status) {
    case "pendente":
      return styles.statusPendente;
    case "confirmado":
      return { borderColor: accentColor, borderWidth: 1.5 };
    case "andamento":
      return styles.statusAndamento;
    case "aguardando":
      return styles.statusAndamento;
    case "finalizado":
      return styles.statusFinalizado;
    case "cancelado":
      return styles.statusCancelado;
  }
}

function statusBadgeMeta(status: StatusAgendamento): {
  label: string;
  type: "default" | "success" | "warning" | "error" | "info";
} {
  switch (status) {
    case "pendente":
      return { label: "Pendente", type: "warning" };
    case "confirmado":
      return { label: "Confirmado", type: "success" };
    case "andamento":
      return { label: "Em andamento", type: "info" };
    case "aguardando":
      return { label: "Aguardando confirmação", type: "warning" };
    case "finalizado":
      return { label: "Finalizado", type: "default" };
    case "cancelado":
      return { label: "Cancelado", type: "error" };
  }
}

function AgendamentoDiaristaCard({
  agendamento,
  accentColor,
  onChanged,
}: {
  agendamento: Agendamento;
  accentColor: string;
  onChanged: () => void;
}) {
  const navigation = useNavigation<Navigation>();
  const status = agendamento.status;
  const badge = statusBadgeMeta(status);
  const [busy, setBusy] = useState(false);
  // preco vem em CENTAVOS (precoFinal Int); "--" = sem valor definido.
  const precoLabel =
    agendamento.preco === "--"
      ? "A combinar"
      : `R$ ${(Number(agendamento.preco) / 100).toFixed(2).replace(".", ",")}`;

  const runAction = (
    fn: (id: string) => Promise<unknown>,
    title: string,
    message: string,
    okLabel: string,
  ) => {
    Alert.alert(title, message, [
      { text: "Cancelar", style: "cancel" },
      {
        text: okLabel,
        onPress: async () => {
          try {
            setBusy(true);
            await fn(agendamento.id);
            onChanged();
          } catch {
            Alert.alert("Erro", "Não foi possível concluir a ação agora. Tente novamente.");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <DCard style={[styles.appointmentCard, statusCardStyle(status, accentColor)]}>
      {/* Topo: cliente + status */}
      <View style={styles.cardTop}>
        <DAvatar
          size="md"
          uri={agendamento.avatarUrl}
          initials={agendamento.nomeCliente.slice(0, 2)}
          online={status === "andamento"}
        />
        <View style={styles.cardTopInfo}>
          <Text style={styles.clientName} numberOfLines={1}>{agendamento.nomeCliente}</Text>
          <Text style={styles.clientSub} numberOfLines={1}>{servicoCompleto(agendamento)}</Text>
        </View>
        <DBadge type={badge.type} label={badge.label} />
      </View>

      {/* Meta: local, data */}
      <View style={styles.cardMeta}>
        <View style={styles.metaRow}>
          <AppIcon name="MapPin" size={13} color={colors.textSecondary} />
          <Text style={styles.metaText} numberOfLines={1}>{agendamento.localizacao}</Text>
        </View>
        <View style={styles.metaRow}>
          <AppIcon name="Calendar" size={13} color={colors.textSecondary} />
          <Text style={styles.metaText} numberOfLines={1}>
            {agendamento.data}, {agendamento.hora}
          </Text>
        </View>
      </View>

      {/* Rodapé: preço + ações */}
      <View style={styles.cardFooter}>
        <Text style={[styles.footerPrice, { color: accentColor }]}>{precoLabel}</Text>
        <View style={styles.footerActions}>
          {status === "pendente" ? (
            <DButton
              variant="primary"
              flat
              tint={accentColor}
              size="sm"
              loading={busy}
              label="Aceitar"
              onPress={() =>
                runAction(aceitarServicoDiarista, "Aceitar serviço", "Deseja aceitar este serviço?", "Aceitar")
              }
            />
          ) : null}
          {status === "andamento" ? (
            <DButton
              variant="primary"
              flat
              tint={accentColor}
              size="sm"
              loading={busy}
              label="Finalizar"
              onPress={() =>
                runAction(concluirServicoDiarista, "Finalizar serviço", "Marcar este serviço como finalizado?", "Finalizar")
              }
            />
          ) : null}
          <DButton
            variant="ghost"
            size="sm"
            labelStyle={{ color: colors.warning }}
            label="Detalhes"
            onPress={() => navigation.navigate("DetalheServico", { id: agendamento.id })}
          />
        </View>
      </View>
    </DCard>
  );
}

export function AgendamentosDiaristaScreen() {
  const navigation = useNavigation<Navigation>();
  const theme = useGenderTheme("DIARISTA");
  const [activeFilter, setActiveFilter] = useState<Filtro>("hoje");
  const { agendamentos: realAgendamentos, loading, error, refetch } = useAgendamentosDiarista();
  const { rooms } = useMensagens();
  const unreadMessages = useMemo(
    () => rooms.reduce((total, room) => total + Math.max(0, Number(room.naoLidas) || 0), 0),
    [rooms],
  );
  const messagesBadge = unreadMessages > 0 ? unreadMessages : undefined;

  const sourceData = realAgendamentos;

  const agendamentos = useMemo(() => {
    if (activeFilter === "pendentes") {
      return sourceData.filter((item) => item.status === "pendente");
    }
    if (activeFilter === "confirmados") {
      return sourceData.filter((item) => item.status === "confirmado");
    }
    if (activeFilter === "concluidos") {
      return sourceData.filter((item) => item.status === "finalizado");
    }
    if (activeFilter === "amanha") {
      return sourceData.filter((item) => item.data === "Amanhã");
    }
    if (activeFilter === "hoje") {
      // "Hoje" = solicitações ativas: chegaram, foram aceitas, em andamento ou
      // aguardando confirmação. Finalizadas saem (ficam na aba "Concluídos");
      // canceladas/recusadas nem chegam a esta lista.
      return sourceData.filter(
        (item) => item.status !== "finalizado" && item.status !== "cancelado",
      );
    }
    return sourceData;
  }, [sourceData, activeFilter]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>Agenda</Text>
            <Text style={styles.subtitle}>Seus agendamentos</Text>
          </View>
          <Pressable
            hitSlop={spacing.sm}
            onPress={() => Alert.alert("Em breve", "Calendário completo ainda não está disponível.")}
          >
            <View style={[styles.calendarButton, { borderColor: theme.border, borderWidth: 1 }]}>
              <AppIcon name="Calendar" size={20} color={theme.icon} />
            </View>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
          <View style={styles.filtersRow}>
            {FILTROS.map((filter) => (
              <FilterChip
                key={filter.value}
                label={filter.label}
                active={activeFilter === filter.value}
                accentColor={theme.primary}
                onPress={() => setActiveFilter(filter.value)}
              />
            ))}
          </View>
        </ScrollView>

        <AgendaResumo total={realAgendamentos.length} accentColor={theme.primary} softBg={theme.primarySoft} />

        {loading && realAgendamentos.length === 0 ? (
          <View style={styles.topState}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : error ? (
          <View style={styles.topState}>
            <Text style={styles.emptyText}>Erro ao carregar agendamentos</Text>
            <DButton variant="primary" flat tint={theme.primary} size="sm" label="Tentar novamente" onPress={refetch} style={styles.retryButton} />
          </View>
        ) : (
          <FlatList
            style={styles.list}
            data={agendamentos}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <AgendamentoDiaristaCard agendamento={item} accentColor={theme.primary} onChanged={refetch} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
            ListEmptyComponent={
              <View style={styles.topState}>
                <View style={[styles.emptyIconBox, { backgroundColor: theme.primarySoft }]}>
                  <AppIcon name="Calendar" size={32} color={theme.primary} strokeWidth={2} />
                </View>
                <Text style={styles.emptyText}>Nenhum agendamento encontrado</Text>
              </View>
            }
            refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={theme.primary} colors={[theme.primary]} />}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

export default AgendamentosDiaristaScreen;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerText: {
    flex: 1,
    paddingRight: spacing.md,
  },
  greeting: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  calendarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  filters: {
    marginVertical: spacing.md,
    // ScrollView horizontal cresce verticalmente dentro de um flex column e
    // empurra o conteúdo p/ o centro — travamos com flexGrow: 0 + maxHeight.
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: 48,
  },
  filtersRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.screenPadding,
  },
  filterChip: {
    borderRadius: radius.full,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1.5,
  },
  filterChipIdle: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  filterLabel: {
    ...typography.caption,
  },
  filterLabelActive: {
    color: colors.white,
    fontWeight: "700",
  },
  filterLabelIdle: {
    color: colors.textSecondary,
    fontWeight: "400",
  },
  calendarCard: {
    marginHorizontal: spacing.screenPadding,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  resumoIconBox: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  calendarTitle: {
    ...typography.bodySmMedium,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  calendarSummary: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  calendarArrows: {
    flexDirection: "row",
    gap: spacing.md,
  },
  calendarArrowButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  weekRow: {
    flexDirection: "row",
  },
  weekDay: {
    flex: 1,
    ...typography.caption,
    fontWeight: "600",
    color: colors.textDisabled,
    textAlign: "center",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarCell: {
    width: "14.285%",
    alignItems: "center",
    paddingVertical: 6,
  },
  calendarDayText: {
    ...typography.bodySm,
    color: colors.textPrimary,
  },
  selectedDay: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedDayText: {
    ...typography.bodySm,
    fontWeight: "700",
    color: colors.white,
  },
  appointmentDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 2,
  },
  listContent: {
    padding: spacing.screenPadding,
    paddingBottom: spacing["5xl"],
  },
  listSeparator: {
    height: spacing.sm,
  },
  appointmentCard: {
    padding: 12,
  },
  statusPendente: {
    borderColor: colors.warning,
    borderWidth: 1.5,
  },
  statusAndamento: {
    borderColor: colors.info,
    borderWidth: 1.5,
  },
  statusFinalizado: {
    borderColor: colors.border,
    opacity: 0.65,
  },
  statusCancelado: {
    borderColor: colors.errorLight,
    opacity: 0.55,
  },
  appointmentRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  appointmentCenter: {
    flex: 1,
  },
  appointmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    ...typography.bodySmMedium,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  ratingRow: {
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "center",
    marginTop: 2,
  },
  ratingText: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  metaRow: {
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "center",
  },
  metaText: {
    flex: 1,
    ...typography.caption,
    color: colors.textSecondary,
  },
  metaStrong: {
    flex: 1,
    ...typography.caption,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardTopInfo: {
    flex: 1,
    gap: 2,
  },
  clientSub: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  cardMeta: {
    marginTop: 10,
    gap: 6,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 8,
  },
  footerPrice: {
    ...typography.bodySmMedium,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  footerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  serviceRow: {
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  serviceText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  price: {
    ...typography.bodySmMedium,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: 6,
  },
  actions: {
    alignItems: "flex-end",
    gap: 7,
  },
  list: {
    flex: 1,
  },
  topState: {
    alignItems: "center",
    paddingTop: spacing.xl,
    paddingHorizontal: spacing["3xl"],
    gap: 8,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing["3xl"],
  },
  emptyIcon: {
    ...typography.h1,
    marginBottom: spacing.md,
  },
  emptyText: {
    ...typography.bodySm,
    color: colors.textSecondary,
    textAlign: "center",
  },
  retryButton: {
    marginTop: spacing.md,
  },
});
