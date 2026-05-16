import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppIcon } from "@/components/ui";
import { api } from "@/lib/api";
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

type ProfissionalServico = {
  id: string;
  nome?: string | null;
  avatarUrl?: string | null;
};

type ServicoEmpregador = {
  id: string;
  status?: string | null;
  tipo?: string | null;
  categoria?: string | null;
  data?: string | null;
  turno?: string | null;
  cidade?: string | null;
  uf?: string | null;
  bairro?: string | null;
  observacoes?: string | null;
  precoFinal?: number | null;
  createdAt?: string | null;
  diarista?: ProfissionalServico | null;
  montador?: ProfissionalServico | null;
};

type MinhasServicosResponse = {
  ok?: boolean;
  servicos?: ServicoEmpregador[];
  error?: string;
};

function normalizeStatus(status?: string | null): AgendamentoItem["status"] {
  const value = String(status ?? "").toUpperCase();
  if (value === "SOLICITADO" || value === "PENDENTE" || value === "RASCUNHO") return "pendente";
  if (value === "ACEITO" || value === "CONFIRMADO") return "aceita";
  if (value === "EM_ANDAMENTO" || value === "AGUARDANDO_FINALIZACAO") return "andamento";
  if (value === "CONCLUIDO" || value === "CONCLUÍDO" || value === "FINALIZADO") return "concluida";
  if (value === "CANCELADO" || value === "RECUSADO") return "cancelada";
  return "pendente";
}

function categoryInfo(servico: ServicoEmpregador) {
  const tipo = String(servico.tipo ?? "").toUpperCase();
  if (tipo === "MONTADOR") {
    return { label: "Montador", key: "montador" as const, icon: "Wrench" as const };
  }
  if (tipo === "BABA") {
    return { label: "Babá", key: "baba" as const, icon: "Baby" as const };
  }
  if (tipo === "COZINHEIRA") {
    return { label: "Cozinheira", key: "cozinheira" as const, icon: "ChefHat" as const };
  }
  return { label: "Diarista", key: "diarista" as const, icon: "BrushCleaning" as const };
}

function categoriaLabel(categoria?: string | null) {
  if (!categoria) return "Serviço";
  return categoria
    .replace(/^MONTADOR_/, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (char) => char.toUpperCase());
}

function formatDateLabel(value?: string | null) {
  if (!value) return "Data a combinar";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data a combinar";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function formatTurno(value?: string | null) {
  const turno = String(value ?? "").toUpperCase();
  if (turno === "MANHA") return "Manhã";
  if (turno === "TARDE") return "Tarde";
  return "Horário a combinar";
}

function formatMoney(value?: number | null) {
  if (typeof value !== "number" || value <= 0) return "A combinar";
  return (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function mapServicoToAgendamento(servico: ServicoEmpregador): AgendamentoItem {
  const category = categoryInfo(servico);
  const profissional = category.key === "montador" ? servico.montador : servico.diarista;
  const cidadeUf = [servico.cidade, servico.uf].filter(Boolean).join(" - ");
  const local = [servico.bairro, cidadeUf].filter(Boolean).join(", ");

  return {
    id: servico.id,
    nome: profissional?.nome?.trim() || "Aguardando profissional",
    status: normalizeStatus(servico.status),
    idade: categoriaLabel(servico.categoria),
    categoria: category.label,
    categoriaKey: category.key,
    categoriaIcon: category.icon,
    local: local || "Local a confirmar",
    data: formatDateLabel(servico.data),
    horario: formatTurno(servico.turno),
    nota: "--",
    experiencia: String(servico.status ?? "Pendente").replace(/_/g, " "),
    valor: formatMoney(servico.precoFinal),
    observacao: servico.observacoes,
    avatarUrl: profissional?.avatarUrl ?? undefined,
  };
}

export function AgendamentosEmpregadorScreen() {
  const navigation = useNavigation<Navigation>();
  const [categoriaAtiva, setCategoriaAtiva] = useState<CategoriaFiltro>("todas");
  const [statusAtivo, setStatusAtivo] = useState<StatusFiltro>("todas");
  const [agendamentos, setAgendamentos] = useState<AgendamentoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    try {
      setError(null);
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      const res = await api.get<MinhasServicosResponse>("/api/servicos/minhas");
      const servicos = Array.isArray(res.data.servicos) ? res.data.servicos : [];
      setAgendamentos(servicos.map(mapServicoToAgendamento));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao carregar solicitações.";
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load("initial");
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load("refresh");
    }, [load]),
  );

  const filteredAgendamentos = useMemo(
    () =>
      agendamentos.filter((item) => {
        const categoryMatch = categoriaAtiva === "todas" || item.categoriaKey === categoriaAtiva;
        return categoryMatch && statusMatchesFilter(item, statusAtivo);
      }),
    [agendamentos, categoriaAtiva, statusAtivo],
  );

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.root}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} />}
        >
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
            {loading ? (
              <View style={s.empty}>
                <AppIcon name="Calendar" size={34} color="purple" variant="soft" />
                <Text style={s.emptyTitle}>Carregando solicitações</Text>
                <Text style={s.emptyText}>Buscando seus serviços enviados.</Text>
              </View>
            ) : error ? (
              <Pressable onPress={() => load("refresh")} style={s.empty}>
                <AppIcon name="AlertTriangle" size={34} color={colors.danger} variant="soft" />
                <Text style={s.emptyTitle}>Não foi possível carregar</Text>
                <Text style={s.emptyText}>{error}</Text>
              </Pressable>
            ) : filteredAgendamentos.length === 0 ? (
              <View style={s.empty}>
                <AppIcon name="Calendar" size={34} color="purple" variant="soft" />
                <Text style={s.emptyTitle}>Nenhum agendamento encontrado</Text>
                <Text style={s.emptyText}>Ajuste os filtros ou envie uma nova solicitação.</Text>
              </View>
            ) : (
              filteredAgendamentos.map((item) => (
                <AppointmentCard
                  key={item.id}
                  item={item}
                  onDetails={() => navigation.navigate("EmpregadorDetalhe", { servicoId: item.id })}
                />
              ))
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
