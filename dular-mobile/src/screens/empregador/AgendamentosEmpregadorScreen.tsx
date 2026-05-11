import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppIcon } from "@/components/ui";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";
import { colors, shadows, spacing, typography } from "@/theme";
import {
  AgendamentoItem,
  AppointmentCard,
  BottomInfoBanner,
  CATEGORIAS,
  CategoriaFiltro,
  CategoryChip,
  STATUS_FILTERS,
  StatusFilterBar,
  StatusChip,
  StatusFiltro,
  statusMatchesFilter,
} from "./agendamentos/components";

type Navigation = BottomTabNavigationProp<EmpregadorTabParamList>;

const MOCK_AGENDAMENTOS: AgendamentoItem[] = [
  {
    id: "ag-luciana-silva",
    nome: "Luciana Silva",
    status: "aceita",
    idade: "32 anos",
    categoria: "Diarista",
    categoriaKey: "diarista",
    categoriaIcon: "BrushCleaning",
    local: "Jardim América, SP",
    data: "Hoje",
    horario: "14:00 - 18:00",
    nota: "4,9",
    experiencia: "5 anos",
    valor: "R$ 180",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&facepad=2&w=180&h=180&q=80",
  },
  {
    id: "ag-juliana-castro",
    nome: "Juliana Castro",
    status: "aceita",
    idade: "28 anos",
    categoria: "Babá",
    categoriaKey: "baba",
    categoriaIcon: "Baby",
    local: "Vila Mariana, SP",
    data: "Amanhã",
    horario: "08:00 - 17:00",
    nota: "4,8",
    experiencia: "3 anos",
    valor: "R$ 160",
    avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=facearea&facepad=2&w=180&h=180&q=80",
  },
  {
    id: "ag-renata-lima",
    nome: "Renata Lima",
    status: "andamento",
    idade: "40 anos",
    categoria: "Cozinheira",
    categoriaKey: "cozinheira",
    categoriaIcon: "ChefHat",
    local: "Moema, SP",
    data: "Sex, 24 Mai",
    horario: "11:00 - 14:00",
    nota: "4,9",
    experiencia: "7 anos",
    valor: "R$ 200",
    avatarUrl: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=facearea&facepad=2&w=180&h=180&q=80",
  },
  {
    id: "ag-carla-souza",
    nome: "Carla Souza",
    status: "aceita",
    idade: "29 anos",
    categoria: "Exp",
    categoriaKey: "exp",
    categoriaIcon: "UserRound",
    local: "Perdizes, SP",
    data: "Sab, 25 Mai",
    horario: "09:00 - 13:00",
    nota: "4,7",
    experiencia: "4 anos",
    valor: "R$ 140",
    avatarUrl: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=facearea&facepad=2&w=180&h=180&q=80",
  },
  {
    id: "ag-a-definir",
    nome: "A definir",
    status: "pendente",
    idade: "-- anos",
    categoria: "Diarista",
    categoriaKey: "diarista",
    categoriaIcon: "BrushCleaning",
    local: "Pinheiros, SP",
    data: "Ter, 28 Mai",
    horario: "14:00 - 18:00",
    nota: "--",
    experiencia: "-- anos",
    valor: "R$ --",
  },
];

export function AgendamentosEmpregadorScreen() {
  const navigation = useNavigation<Navigation>();
  const [categoriaAtiva, setCategoriaAtiva] = useState<CategoriaFiltro>("todas");
  const [statusAtivo, setStatusAtivo] = useState<StatusFiltro>("todas");

  const filteredAgendamentos = useMemo(
    () =>
      MOCK_AGENDAMENTOS.filter((item) => {
        const categoryMatch = categoriaAtiva === "todas" || item.categoriaKey === categoriaAtiva;
        return categoryMatch && statusMatchesFilter(item, statusAtivo);
      }),
    [categoriaAtiva, statusAtivo],
  );

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.root}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          <View style={s.header}>
            <Pressable
              onPress={() => navigation.navigate("Home")}
              style={({ pressed }) => [s.backButton, pressed && { opacity: 0.7 }]}
              hitSlop={10}
            >
              <AppIcon name="ArrowLeft" size={20} color={colors.primary} strokeWidth={2.2} />
            </Pressable>
            <View style={s.headerCopy}>
              <Text style={s.title}>Solicitações</Text>
              <Text style={s.subtitle}>Acompanhe todas as suas solicitações</Text>
            </View>
            <Pressable onPress={() => navigation.navigate("Notificacoes")} style={({ pressed }) => [s.bellButton, pressed && { opacity: 0.78 }]} hitSlop={10}>
              <AppIcon name="Bell" size={21} color={colors.primary} strokeWidth={2.2} />
              <View style={s.bellDot} />
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalChips}>
            {CATEGORIAS.map((chip) => (
              <CategoryChip
                key={chip.value}
                label={chip.label}
                icon={chip.icon}
                active={categoriaAtiva === chip.value}
                onPress={() => setCategoriaAtiva(chip.value)}
              />
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalChips}>
            <StatusFilterBar>
              {STATUS_FILTERS.map((chip) => (
                <StatusChip
                  key={chip.value}
                  label={chip.label}
                  color={chip.color}
                  active={statusAtivo === chip.value}
                  onPress={() => setStatusAtivo(chip.value)}
                />
              ))}
            </StatusFilterBar>
          </ScrollView>

          <View style={s.list}>
            {filteredAgendamentos.length === 0 ? (
              <View style={s.empty}>
                <AppIcon name="Calendar" size={34} color="purple" variant="soft" />
                <Text style={s.emptyTitle}>Nenhum agendamento encontrado</Text>
                <Text style={s.emptyText}>Ajuste os filtros para ver outras solicitações.</Text>
              </View>
            ) : (
              filteredAgendamentos.map((item) => <AppointmentCard key={item.id} item={item} />)
            )}
          </View>

          <BottomInfoBanner
            onPress={() => Alert.alert("Histórico", "Histórico completo em breve.")}
          />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

export default AgendamentosEmpregadorScreen;

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  root: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 10,
    paddingBottom: 40,
    gap: 9,
  },
  header: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  bellDot: {
    position: "absolute",
    top: 11,
    right: 12,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.notification,
  },
  title: {
    color: colors.primaryDark,
    ...typography.h1,
    
    fontWeight: "700",
    letterSpacing: 0,
  },
  subtitle: {
    color: colors.textSecondary,
    ...typography.caption,
    
    fontWeight: "500",
  },
  horizontalChips: {
    gap: 7,
    paddingVertical: 1,
    paddingRight: spacing.screenPadding,
  },
  list: {
    gap: 9,
  },
  empty: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    color: colors.textPrimary,
    ...typography.bodyMedium,
    
    fontWeight: "700",
    textAlign: "center",
  },
  emptyText: {
    color: colors.textSecondary,
    ...typography.caption,
    
    fontWeight: "500",
    textAlign: "center",
  },
});
