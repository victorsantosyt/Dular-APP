import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppIcon, DAvatar, DBadge, DBottomNav, DButton, DCard } from "@/components/ui";
import { colors, radius, spacing } from "@/theme";
import { useAuth } from "@/stores/authStore";
import type { DiaristaTabParamList } from "@/navigation/DiaristaNavigator";
import { useAgendamentosDiarista } from "@/hooks/useAgendamentosDiarista";

type Navigation = BottomTabNavigationProp<DiaristaTabParamList>;
type Filtro = "hoje" | "amanha" | "semana" | "pendentes" | "confirmados" | "concluidos";
type StatusAgendamento = "pendente" | "confirmado" | "andamento" | "finalizado" | "cancelado";

type Agendamento = {
  id: string;
  nomeCliente: string;
  avaliacao: string;
  localizacao: string;
  servico: string;
  data: string;
  hora: string;
  preco: string;
  status: StatusAgendamento;
  avatarUrl?: string;
};

const FILTROS: { label: string; value: Filtro }[] = [
  { label: "Hoje", value: "hoje" },
  { label: "Amanhã", value: "amanha" },
  { label: "Semana", value: "semana" },
  { label: "Pendentes", value: "pendentes" },
  { label: "Confirmados", value: "confirmados" },
  { label: "Concluídos", value: "concluidos" },
];

const WEEK_DAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const CALENDAR_DAYS = Array.from({ length: 28 }, (_, index) => index + 1);
const APPOINTMENT_DAYS = new Set([14, 15, 19, 22]);
const SELECTED_DAY = 14;

const AGENDAMENTOS: Agendamento[] = [
  {
    id: "1",
    nomeCliente: "Carolina Mendes",
    avaliacao: "4,8",
    localizacao: "Vila Mariana",
    servico: "Limpeza Completa",
    data: "Hoje",
    hora: "14:00 - 18:00",
    preco: "180",
    status: "pendente",
    avatarUrl: "",
  },
  {
    id: "2",
    nomeCliente: "Juliana Pereira",
    avaliacao: "4,9",
    localizacao: "Moema",
    servico: "Limpeza Geral",
    data: "Hoje",
    hora: "09:00 - 13:00",
    preco: "150",
    status: "confirmado",
    avatarUrl: "",
  },
  {
    id: "3",
    nomeCliente: "Fernanda Costa",
    avaliacao: "4,7",
    localizacao: "Perdizes",
    servico: "Limpeza Completa",
    data: "Sex, 24 Mai",
    hora: "11:00 - 15:00",
    preco: "170",
    status: "andamento",
    avatarUrl: "",
  },
  {
    id: "4",
    nomeCliente: "Beatriz Lima",
    avaliacao: "5,0",
    localizacao: "Jardim América",
    servico: "Limpeza Pós-Obra",
    data: "Qui, 23 Mai",
    hora: "08:00 - 14:00",
    preco: "220",
    status: "finalizado",
    avatarUrl: "",
  },
  {
    id: "5",
    nomeCliente: "Ana Paula Rocha",
    avaliacao: "4,6",
    localizacao: "Itaim Bibi",
    servico: "Limpeza Geral",
    data: "Qua, 22 Mai",
    hora: "14:00 - 18:00",
    preco: "150",
    status: "cancelado",
    avatarUrl: "",
  },
];

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <View style={[styles.filterChip, active ? styles.filterChipActive : styles.filterChipIdle]}>
        <Text style={[styles.filterLabel, active ? styles.filterLabelActive : styles.filterLabelIdle]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function CalendarDay({ day }: { day: number }) {
  const selected = day === SELECTED_DAY;
  const hasAppointment = APPOINTMENT_DAYS.has(day);

  return (
    <View style={styles.calendarCell}>
      {selected ? (
        <View style={styles.selectedDay}>
          <Text style={styles.selectedDayText}>{day}</Text>
        </View>
      ) : (
        <Text style={styles.calendarDayText}>{day}</Text>
      )}
      {hasAppointment && !selected ? <View style={styles.appointmentDot} /> : null}
    </View>
  );
}

function MiniCalendar() {
  return (
    <DCard style={styles.calendarCard}>
      <View style={styles.calendarHeader}>
        <Text style={styles.calendarTitle}>Maio 2025</Text>
        <View style={styles.calendarArrows}>
          <Pressable hitSlop={spacing.xs}>
            <View style={styles.calendarArrowButton}>
              <AppIcon name="ArrowLeft" size={18} color={colors.primary} strokeWidth={2.4} />
            </View>
          </Pressable>
          <Pressable hitSlop={spacing.xs}>
            <View style={styles.calendarArrowButton}>
              <AppIcon name="ChevronRight" size={18} color={colors.primary} strokeWidth={2.4} />
            </View>
          </Pressable>
        </View>
      </View>

      <View style={styles.weekRow}>
        {WEEK_DAYS.map((day, index) => (
          <Text key={`${day}-${index}`} style={styles.weekDay}>
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {CALENDAR_DAYS.map((day) => (
          <CalendarDay key={day} day={day} />
        ))}
      </View>
    </DCard>
  );
}

function statusCardStyle(status: StatusAgendamento) {
  switch (status) {
    case "pendente":
      return styles.statusPendente;
    case "confirmado":
      return styles.statusConfirmado;
    case "andamento":
      return styles.statusAndamento;
    case "finalizado":
      return styles.statusFinalizado;
    case "cancelado":
      return styles.statusCancelado;
  }
}

function AgendamentoDiaristaCard({ agendamento }: { agendamento: Agendamento }) {
  const navigation = useNavigation<Navigation>();
  const finished = agendamento.status === "finalizado";
  const canceled = agendamento.status === "cancelado";

  return (
    <DCard style={[styles.appointmentCard, statusCardStyle(agendamento.status)]}>
      <View style={styles.appointmentRow}>
        <DAvatar
          size="md"
          uri={agendamento.avatarUrl}
          initials={agendamento.nomeCliente.slice(0, 2)}
          online={agendamento.status === "andamento"}
        />

        <View style={styles.appointmentCenter}>
          <View style={styles.appointmentHeader}>
            <View style={styles.clientInfo}>
              <Text style={styles.clientName}>{agendamento.nomeCliente}</Text>
              <View style={styles.ratingRow}>
                <AppIcon name="Star" size={12} color={colors.pink} strokeWidth={2.4} />
                <Text style={styles.ratingText}>{agendamento.avaliacao}</Text>
              </View>
            </View>
            {finished ? <DBadge type="default" label="Finalizado" /> : null}
            {canceled ? <DBadge type="error" label="Cancelado" /> : null}
          </View>

          <View style={styles.metaRow}>
            <AppIcon name="MapPin" size={12} color={colors.textSecondary} />
            <Text style={styles.metaText}>{agendamento.localizacao}</Text>
          </View>
          <View style={styles.serviceRow}>
            <AppIcon name="Sparkles" size={12} color={colors.primary} strokeWidth={2.3} />
            <Text style={styles.serviceText}>{agendamento.servico}</Text>
          </View>
          <View style={styles.metaRow}>
            <AppIcon name="Calendar" size={12} color={colors.textSecondary} />
            <Text style={styles.metaText}>
              {agendamento.data}, {agendamento.hora}
            </Text>
          </View>
          <Text style={styles.price}>R$ {agendamento.preco}</Text>
        </View>

        <View style={styles.actions}>
          {agendamento.status === "pendente" ? (
            <DButton variant="primary" size="sm" label="Confirmar" onPress={() => undefined} />
          ) : null}
          {agendamento.status === "confirmado" ? (
            <DButton variant="secondary" size="sm" label="Ver rota" onPress={() => undefined} />
          ) : null}
          {agendamento.status === "andamento" ? (
            <DButton variant="primary" size="sm" label="Finalizar" onPress={() => undefined} />
          ) : null}
          <DButton
            variant="ghost"
            size="sm"
            label="Ver detalhes"
            onPress={() => navigation.navigate("DetalheServico", { id: agendamento.id })}
          />
        </View>
      </View>
    </DCard>
  );
}

export function AgendamentosDiaristaScreen() {
  const navigation = useNavigation<Navigation>();
  const { user } = useAuth();
  const firstName = (user?.nome || "Diarista").trim().split(/\s+/)[0];
  const [activeFilter, setActiveFilter] = useState<Filtro>("hoje");
  const { agendamentos: realAgendamentos, loading, error, refetch } = useAgendamentosDiarista();

  const sourceData = realAgendamentos.length > 0 ? realAgendamentos : AGENDAMENTOS;

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
    return sourceData;
  }, [sourceData, activeFilter]);

  const handleBottomNav = (tab: "home" | "search" | "new" | "messages" | "profile") => {
    if (tab === "home") navigation.navigate("Home");
    if (tab === "messages") navigation.navigate("Mensagens");
    if (tab === "profile") navigation.navigate("Perfil");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>Olá, {firstName}</Text>
            <Text style={styles.subtitle}>Seus agendamentos</Text>
          </View>
          <Pressable hitSlop={spacing.sm}>
            <View style={styles.calendarButton}>
              <AppIcon name="Calendar" size={20} color="purple" />
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
                onPress={() => setActiveFilter(filter.value)}
              />
            ))}
          </View>
        </ScrollView>

        <MiniCalendar />

        {loading && realAgendamentos.length === 0 ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <Text style={styles.emptyText}>Erro ao carregar agendamentos</Text>
            <DButton variant="primary" size="sm" label="Tentar novamente" onPress={refetch} style={styles.retryButton} />
          </View>
        ) : (
          <FlatList
            data={agendamentos}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <AgendamentoDiaristaCard agendamento={item} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
            ListEmptyComponent={
              <View style={styles.centerState}>
                <AppIcon name="Calendar" size={36} color={colors.primary} variant="soft" />
                <Text style={styles.emptyText}>Nenhum agendamento encontrado</Text>
              </View>
            }
            refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} colors={[colors.primary]} />}
          />
        )}

        <DBottomNav variant="diarista" activeTab="new" onPress={handleBottomNav} />
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerText: {
    flex: 1,
    paddingRight: spacing.md,
  },
  greeting: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  calendarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  filters: {
    marginVertical: spacing.md,
  },
  filtersRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  filterChip: {
    borderRadius: radius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 1.5,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipIdle: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  filterLabel: {
    fontSize: 13,
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
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  calendarTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
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
    fontSize: 11,
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
    fontSize: 13,
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
    fontSize: 13,
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
    padding: spacing.lg,
    paddingBottom: spacing["5xl"],
  },
  listSeparator: {
    height: spacing.sm,
  },
  appointmentCard: {
    padding: spacing.md,
  },
  statusPendente: {
    borderColor: colors.warning,
    borderWidth: 1.5,
  },
  statusConfirmado: {
    borderColor: colors.primary,
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
    gap: spacing.md,
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
    fontSize: 15,
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
    fontSize: 12,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  metaRow: {
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "center",
    marginTop: 6,
  },
  metaText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  serviceRow: {
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  serviceText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  price: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.primary,
    marginTop: 6,
  },
  actions: {
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing["3xl"],
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
  },
  retryButton: {
    marginTop: spacing.md,
  },
});
