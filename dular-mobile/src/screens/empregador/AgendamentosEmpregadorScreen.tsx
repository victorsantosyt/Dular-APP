import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppIcon, AppIconName, DAvatar, DBadge, DBottomNav, DButton, DCard } from "@/components/ui";
import { colors, radius, shadows, spacing } from "@/theme";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";
import { useAgendamentosEmpregador } from "@/hooks/useAgendamentosEmpregador";
import { useMensagens } from "@/hooks/useMensagens";

type Navigation = BottomTabNavigationProp<EmpregadorTabParamList>;
type CategoriaFiltro = "todas" | "diarista" | "baba" | "cozinheira" | "exp";
type StatusFiltro = "todas" | "aceitas" | "andamento" | "concluidas" | "canceladas";
type StatusAgendamento = "pendente" | "aceita" | "andamento" | "concluida" | "cancelada";

type Agendamento = {
  id: string;
  nome: string;
  idade: string;
  categoria: string;
  categoriaKey: CategoriaFiltro;
  categoriaIcon: AppIconName;
  localizacao: string;
  data: string;
  hora: string;
  avaliacao: string;
  experiencia: string;
  preco: string;
  status: StatusAgendamento;
  avatarUrl?: string;
};

type StatusConfig = {
  type: "default" | "success" | "warning" | "error" | "info";
  label: string;
  btnLabel: string;
  btnBg: string;
  btnColor: string;
};

const CATEGORIA_CHIPS: { icon: AppIconName; label: string; value: CategoriaFiltro }[] = [
  { icon: "SlidersHorizontal", label: "Todas", value: "todas" },
  { icon: "Sparkles", label: "Diarista", value: "diarista" },
  { icon: "Baby", label: "Babá", value: "baba" },
  { icon: "ChefHat", label: "Cozinheira", value: "cozinheira" },
  { icon: "User", label: "Extra", value: "exp" },
];

const STATUS_CHIPS: { label: string; value: StatusFiltro; dot?: string }[] = [
  { label: "Todas", value: "todas" },
  { label: "Aceitas", value: "aceitas", dot: colors.success },
  { label: "Em andamento", value: "andamento", dot: colors.info },
  { label: "Concluídas", value: "concluidas", dot: colors.textDisabled },
  { label: "Canceladas", value: "canceladas", dot: colors.error },
];

const STATUS_FILTER_MAP: Record<Exclude<StatusFiltro, "todas">, StatusAgendamento> = {
  aceitas: "aceita",
  andamento: "andamento",
  concluidas: "concluida",
  canceladas: "cancelada",
};

const STATUS_MAP: Record<StatusAgendamento, StatusConfig> = {
  pendente: {
    type: "warning",
    label: "Pendente",
    btnLabel: "Aguardando",
    btnBg: colors.warningLight,
    btnColor: colors.warning,
  },
  aceita: {
    type: "success",
    label: "Aceita",
    btnLabel: "Confirmado",
    btnBg: colors.primary,
    btnColor: colors.white,
  },
  andamento: {
    type: "info",
    label: "Em andamento",
    btnLabel: "Em andamento",
    btnBg: colors.infoLight,
    btnColor: colors.info,
  },
  concluida: {
    type: "default",
    label: "Concluída",
    btnLabel: "Concluído",
    btnBg: colors.surfaceAlt,
    btnColor: colors.textSecondary,
  },
  cancelada: {
    type: "error",
    label: "Cancelada",
    btnLabel: "Cancelado",
    btnBg: colors.errorLight,
    btnColor: colors.error,
  },
};

function NotificationButton({
  unreadMessages,
  onPress,
}: {
  unreadMessages: number;
  onPress: () => void;
}) {
  const badgeLabel = unreadMessages > 9 ? "9+" : String(unreadMessages);

  return (
    <Pressable hitSlop={spacing.sm} onPress={onPress}>
      <View style={styles.notificationButton}>
        <AppIcon name="Bell" size={20} color="purple" />
        {unreadMessages > 0 ? (
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationBadgeText}>{badgeLabel}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function FilterChip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: AppIconName;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <View style={[styles.filterChip, active ? styles.filterChipActive : styles.filterChipIdle]}>
        <AppIcon
          name={icon}
          size={14}
          color={active ? colors.white : colors.primary}
          strokeWidth={2.3}
        />
        <Text style={[styles.filterLabel, active ? styles.filterLabelActive : styles.filterLabelIdle]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function StatusChip({
  label,
  dot,
  active,
  onPress,
}: {
  label: string;
  dot?: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <View style={[styles.statusChip, active ? styles.statusChipActive : styles.statusChipIdle]}>
        {dot ? <View style={[styles.statusDot, { backgroundColor: dot }]} /> : null}
        <Text style={[styles.statusLabel, active ? styles.statusLabelActive : styles.statusLabelIdle]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function AgendamentoCard({ agendamento }: { agendamento: Agendamento }) {
  const navigation = useNavigation<Navigation>();
  const statusConfig = STATUS_MAP[agendamento.status];
  const muted = agendamento.status === "cancelada" || agendamento.status === "concluida";

  return (
    <DCard style={[styles.appointmentCard, muted ? styles.appointmentCardMuted : styles.appointmentCardActive]}>
      <View style={styles.appointmentRow}>
        <View style={styles.avatarWrap}>
          <DAvatar
            size="lg"
            uri={agendamento.avatarUrl}
            initials={agendamento.nome.slice(0, 2)}
            online={agendamento.status === "andamento"}
          />
          <View style={styles.statusBadgeWrap}>
            <DBadge type={statusConfig.type} label={statusConfig.label} />
          </View>
        </View>

        <View style={styles.appointmentCenter}>
          <View style={styles.nameRow}>
            <Text style={styles.appointmentName}>{agendamento.nome}</Text>
            <Text style={styles.appointmentAge}>
              {agendamento.idade === "A definir" ? "• A definir" : `• ${agendamento.idade} anos`}
            </Text>
          </View>
          <View style={styles.categoryBadge}>
            <AppIcon name={agendamento.categoriaIcon} size={12} color={colors.primary} />
            <Text style={styles.categoryBadgeText}>{agendamento.categoria}</Text>
          </View>
          <View style={styles.metaRow}>
            <AppIcon name="MapPin" size={12} color={colors.textSecondary} />
            <Text style={styles.metaText}>{agendamento.localizacao}</Text>
          </View>
          <View style={styles.metaRow}>
            <AppIcon name="Calendar" size={12} color={colors.textSecondary} />
            <Text style={styles.metaText}>
              {agendamento.data} • {agendamento.hora}
            </Text>
          </View>
          <View style={styles.ratingRow}>
            <AppIcon name="Star" size={12} color={colors.pink} strokeWidth={2.4} />
            <Text style={styles.ratingText}>{agendamento.avaliacao}</Text>
            <Text style={styles.separator}>•</Text>
            <Text style={styles.metaText}>{agendamento.experiencia}</Text>
          </View>
          <Text style={styles.price}>
            {agendamento.preco === "Sob consulta" ? agendamento.preco : `R$ ${agendamento.preco}`}
          </Text>
        </View>

        <View style={styles.appointmentRight}>
          <View style={[styles.statusButton, { backgroundColor: statusConfig.btnBg }]}>
            {agendamento.status === "aceita" ? (
              <AppIcon name="Check" size={12} color={colors.white} strokeWidth={3} />
            ) : null}
            <Text style={[styles.statusButtonText, { color: statusConfig.btnColor }]}>
              {statusConfig.btnLabel}
            </Text>
          </View>
          <DButton
            variant="secondary"
            size="sm"
            label="Ver detalhes"
            onPress={() => navigation.navigate("DetalheServico", { id: agendamento.id })}
            style={styles.detailsButton}
          />
        </View>
      </View>
    </DCard>
  );
}

function InfoCard({ onHistoricoPress }: { onHistoricoPress: () => void }) {
  return (
    <DCard style={styles.infoCard}>
      <View style={styles.infoIconBox}>
        <AppIcon name="Calendar" variant="soft" color="purple" />
      </View>
      <View style={styles.infoText}>
        <Text style={styles.infoTitle}>Precisou mudar algo?</Text>
        <Text style={styles.infoSubtitle}>
          Você pode reagendar ou cancelar seus serviços facilmente.
        </Text>
      </View>
      <DButton variant="primary" size="sm" label="Ver histórico" onPress={onHistoricoPress} />
    </DCard>
  );
}

export function AgendamentosEmpregadorScreen() {
  const navigation = useNavigation<Navigation>();
  const [categoriaAtiva, setCategoriaAtiva] = useState<CategoriaFiltro>("todas");
  const [statusAtivo, setStatusAtivo] = useState<StatusFiltro>("todas");
  const { agendamentos: realAgendamentos, loading, error, refetch } = useAgendamentosEmpregador();
  const { rooms } = useMensagens();
  const unreadMessages = useMemo(
    () => rooms.reduce((total, room) => total + Math.max(0, Number(room.naoLidas) || 0), 0),
    [rooms],
  );
  const messagesBadge = unreadMessages > 0 ? unreadMessages : undefined;

  const sourceData = realAgendamentos;

  const agendamentos = useMemo(() => {
    return sourceData.filter((item) => {
      const categoryMatch = categoriaAtiva === "todas" || item.categoriaKey === categoriaAtiva;
      const statusMatch =
        statusAtivo === "todas" || item.status === STATUS_FILTER_MAP[statusAtivo];
      return categoryMatch && statusMatch;
    });
  }, [sourceData, categoriaAtiva, statusAtivo]);

  const handleBottomNav = (tab: "home" | "search" | "new" | "messages" | "profile") => {
    if (tab === "home") navigation.navigate("Home");
    if (tab === "search") navigation.navigate("Buscar");
    if (tab === "messages") navigation.navigate("Mensagens");
    if (tab === "profile") navigation.navigate("Perfil");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text style={styles.screenTitle}>Agendamentos</Text>
              <Text style={styles.screenSubtitle}>Acompanhe todas as suas solicitações</Text>
            </View>
            <NotificationButton
              unreadMessages={unreadMessages}
              onPress={() => navigation.navigate("Mensagens")}
            />
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryFilters}>
          <View style={styles.chipsRow}>
            {CATEGORIA_CHIPS.map((chip) => (
              <FilterChip
                key={chip.value}
                icon={chip.icon}
                label={chip.label}
                active={categoriaAtiva === chip.value}
                onPress={() => setCategoriaAtiva(chip.value)}
              />
            ))}
          </View>
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusFilters}>
          <View style={styles.chipsRow}>
            {STATUS_CHIPS.map((chip) => (
              <StatusChip
                key={chip.value}
                label={chip.label}
                dot={chip.dot}
                active={statusAtivo === chip.value}
                onPress={() => setStatusAtivo(chip.value)}
              />
            ))}
          </View>
        </ScrollView>

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
            renderItem={({ item }) => <AgendamentoCard agendamento={item} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
            ListEmptyComponent={
              <View style={styles.centerState}>
                <AppIcon name="Calendar" size={36} color={colors.primary} variant="soft" />
                <Text style={styles.emptyText}>Nenhum agendamento encontrado</Text>
              </View>
            }
            ListFooterComponent={
              agendamentos.length > 0 ? (
                <InfoCard
                  onHistoricoPress={() => Alert.alert("Em breve", "Histórico completo ainda não está disponível.")}
                />
              ) : null
            }
            refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} colors={[colors.primary]} />}
          />
        )}

        <DBottomNav activeTab="new" messagesBadge={messagesBadge} onPress={handleBottomNav} />
      </View>
    </SafeAreaView>
  );
}

export default AgendamentosEmpregadorScreen;

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
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerText: {
    flex: 1,
    paddingRight: spacing.md,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  screenSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    ...shadows.soft,
  },
  notificationBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.white,
  },
  categoryFilters: {
    marginBottom: spacing.sm,
  },
  statusFilters: {
    marginBottom: spacing.lg,
  },
  chipsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  filterChip: {
    borderRadius: radius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg - spacing.xs / 2,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipIdle: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    ...shadows.soft,
  },
  filterLabel: {
    fontSize: 13,
  },
  filterLabelActive: {
    fontWeight: "700",
    color: colors.white,
  },
  filterLabelIdle: {
    fontWeight: "400",
    color: colors.textSecondary,
  },
  statusChip: {
    paddingVertical: spacing.sm - 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  statusChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  statusChipIdle: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  statusDot: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: spacing.xs,
  },
  statusLabel: {
    fontSize: 13,
  },
  statusLabelActive: {
    fontWeight: "700",
    color: colors.primary,
  },
  statusLabelIdle: {
    fontWeight: "400",
    color: colors.textSecondary,
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
  appointmentCardActive: {
    opacity: 1,
  },
  appointmentCardMuted: {
    opacity: 0.7,
  },
  appointmentRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  avatarWrap: {
    position: "relative",
  },
  statusBadgeWrap: {
    position: "absolute",
    top: -spacing.sm,
    left: -spacing.xs,
  },
  appointmentCenter: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  appointmentName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  appointmentAge: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  categoryBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    alignSelf: "flex-start",
    marginTop: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  categoryBadgeText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "600",
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
  ratingRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  separator: {
    color: colors.textDisabled,
  },
  price: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.primary,
    marginTop: 6,
  },
  appointmentRight: {
    width: 100,
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  statusButton: {
    borderRadius: radius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  statusButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  detailsButton: {
    width: 108,
  },
  infoCard: {
    marginTop: spacing.md,
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
  },
  infoIconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  infoText: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  infoSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
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
