import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useBottomTabBarHeight, type BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppIcon } from "@/components/ui";
import { fetchServicosMinhas } from "@/api/sharedFetcher";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import { useGenderTheme } from "@/hooks/useProfileTheme";
import { getBottomNavContentPadding } from "@/navigation/bottomNavLayout";
import { shouldShowHistoryBanner } from "./agendamentos/historyBanner";
import { statusMatchesFilter } from "./agendamentos/statusFiltro";
import {
  AgendamentoItem,
  AppointmentCard,
  BottomInfoBanner,
  CATEGORIAS,
  CategoriaFiltro,
  CategoryChip,
  STATUS_FILTERS,
  StatusChip,
  StatusFiltro,
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
  reagendamentoData?: string | null;
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
  if (value === "ACEITO") return "aceita";
  if (value === "EM_ANDAMENTO" || value === "AGUARDANDO_FINALIZACAO") return "andamento";
  // CONFIRMADO é terminal: só se chega nele a partir de CONCLUIDO, pela rota
  // `/servicos/[id]/confirmar`, e dali só se segue para FINALIZADO. O chat já
  // está arquivado e a avaliação já é permitida. O pill dizia "Aceita" enquanto
  // o filtro o classificava em Concluídas — mesma linha, duas respostas.
  if (
    value === "CONCLUIDO" ||
    value === "CONCLUÍDO" ||
    value === "CONFIRMADO" ||
    value === "FINALIZADO"
  )
    return "concluida";
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
  // Nichos novos da profissional de casa — filtram sob "Diarista", rótulo/ícone próprios.
  if (tipo === "PASSA_ROUPA") {
    return { label: "Passadeira", key: "diarista" as const, icon: "Shirt" as const };
  }
  if (tipo === "LAVADEIRA") {
    return { label: "Lavadeira", key: "diarista" as const, icon: "WashingMachine" as const };
  }
  if (tipo === "CUIDADORA") {
    return { label: "Cuidadora", key: "diarista" as const, icon: "Heart" as const };
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
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Data a combinar";
  // A data é gravada como meia-noite UTC; lemos os componentes em UTC para não
  // deslizar o dia em fuso negativo (Brasil, UTC-3).
  const date = new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
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
    precoFinalCentavos: typeof servico.precoFinal === "number" ? servico.precoFinal : 0,
    statusRaw: String(servico.status ?? "").toUpperCase(),
    observacao: servico.observacoes,
    avatarUrl: profissional?.avatarUrl ?? undefined,
    reagendamentoPendente: !!servico.reagendamentoData,
  };
}

export function AgendamentosEmpregadorScreen() {
  // Cor do título seguindo o perfil (ver comentário em `title`).
  const theme = useGenderTheme();
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
      const data = (await fetchServicosMinhas()) as MinhasServicosResponse;
      const servicos = Array.isArray(data?.servicos) ? data.servicos : [];
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
  const tabBarHeight = useBottomTabBarHeight();
  const bottomContentPadding = getBottomNavContentPadding(tabBarHeight, spacing.md);
  const showHistoryBanner = !loading && !error && shouldShowHistoryBanner({
    category: categoriaAtiva,
    status: statusAtivo,
    resultCount: filteredAgendamentos.length,
  });

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.root}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.scroll, { paddingBottom: bottomContentPadding }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} />}
        >
          <View style={s.header}>
            <View style={s.headerCopy}>
              <Text style={[s.title, { color: theme.textAccent }]}>Solicitações</Text>
              <Text style={s.subtitle}>Acompanhe todas as suas solicitações</Text>
            </View>
          </View>

          {/* As duas fileiras de filtro dentro da MESMA barra que a Agenda da
              diarista e a do montador usam. Antes, na mesma tela, os chips de
              categoria ficavam soltos sobre o fundo e os de status já tinham
              uma barra própria — duas fileiras irmãs com tratamento
              diferente. */}
          <View style={[s.filtersBar, { borderColor: theme.border, backgroundColor: theme.primarySoft }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filtersRow}>
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
          </View>

          <View style={[s.filtersBar, { borderColor: theme.border, backgroundColor: theme.primarySoft }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filtersRow}>
              {STATUS_FILTERS.map((chip) => (
                <StatusChip
                  key={chip.value}
                  label={chip.label}
                  color={chip.color}
                  active={statusAtivo === chip.value}
                  onPress={() => setStatusAtivo(chip.value)}
                />
              ))}
            </ScrollView>
          </View>

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
              agendamentos.length === 0 ? (
                <Pressable onPress={() => navigation.navigate("Buscar")} style={s.empty}>
                  <AppIcon name="Calendar" size={34} color="purple" variant="soft" />
                  <Text style={s.emptyTitle}>Você ainda não tem solicitações</Text>
                  <Text style={s.emptyText}>
                    Vá em Buscar, escolha um profissional e solicite um serviço. Ele aparecerá aqui.
                  </Text>
                </Pressable>
              ) : (
                <View style={s.empty}>
                  <AppIcon name="Calendar" size={34} color="purple" variant="soft" />
                  <Text style={s.emptyTitle}>Nenhum agendamento neste filtro</Text>
                  <Text style={s.emptyText}>Ajuste os filtros para ver outras solicitações.</Text>
                </View>
              )
            ) : (
              filteredAgendamentos.map((item) => (
                <AppointmentCard
                  key={item.id}
                  item={item}
                  onDetails={() => navigation.navigate("EmpregadorDetalhe", { servicoId: item.id })}
                  onChat={() =>
                    navigation.navigate("ChatAberto", {
                      roomId: item.id,
                      servicoId: item.id,
                      nomeUsuario: item.nome,
                    })
                  }
                />
              ))
            )}
          </View>

          {showHistoryBanner ? (
            <View style={s.bannerFooter}>
              <BottomInfoBanner onPress={() => navigation.navigate("Historico")} />
            </View>
          ) : null}
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
    gap: 9,
  },
  bannerFooter: {
    alignItems: "center",
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
  title: {

    // Título das telas principais: um corpo (h1) e a cor de destaque do

    // PERFIL — roxo no empregador, rosa na diarista, verde no montador.

    // Antes cada tela escolhia um tamanho (h1, h2, h3, 22, 24) e umas

    // usavam texto preto enquanto outras usavam um roxo fixo, que ficaria

    // fora de lugar nos perfis não-roxos.

    ...typography.h1,

    textAlign: "center",

  },
  subtitle: {
    color: colors.textSecondary,
    ...typography.caption,
    
    fontWeight: "500",
    textAlign: "center",
  },
  filtersBar: {
    borderRadius: radius.full,
    borderWidth: 1,
    padding: 4,
  },
  filtersRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 2 },
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
