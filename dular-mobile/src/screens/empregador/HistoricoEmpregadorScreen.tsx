/**
 * HistoricoEmpregadorScreen
 *
 * Lista serviços encerrados do empregador.
 * Fonte: GET /api/servicos/minhas (filtrado por status finais).
 *
 * Sem mocks: se a lista vier vazia ou só tiver itens ativos, mostra empty state.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";

import {
  AppIcon,
  DEmptyState,
  DErrorState,
  DScreenHeader,
  DSkeletonCard,
} from "@/components/ui";
import { api } from "@/lib/api";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";

type Navigation = BottomTabNavigationProp<EmpregadorTabParamList>;

const STATUS_HISTORICO = [
  "CONCLUIDO",
  "CONCLUÍDO",
  "CONFIRMADO",
  "FINALIZADO",
  "FINALIZADO_CLIENTE",
  "PAGO",
  "AVALIADO",
  "CANCELADO",
  "RECUSADO",
];

type ProfissionalRaw = {
  id?: string | null;
  nome?: string | null;
  avatarUrl?: string | null;
};

type ServicoRaw = {
  id: string;
  status?: string | null;
  tipo?: string | null;
  categoria?: string | null;
  data?: string | null;
  turno?: string | null;
  cidade?: string | null;
  uf?: string | null;
  bairro?: string | null;
  precoFinal?: number | null;
  createdAt?: string | null;
  diarista?: ProfissionalRaw | null;
  montador?: ProfissionalRaw | null;
};

type MinhasResponse = {
  ok?: boolean;
  servicos?: ServicoRaw[];
  error?: string;
};

type StatusVariant = "success" | "warning" | "danger" | "neutral";

type HistoricoItem = {
  id: string;
  nome: string;
  categoriaLabel: string;
  statusLabel: string;
  statusVariant: StatusVariant;
  dataLabel: string;
  localLabel: string;
  precoLabel?: string;
};

function statusUp(value?: string | null): string {
  return String(value ?? "").toUpperCase();
}

function statusLabel(status: string): string {
  switch (status) {
    case "CONCLUIDO":
    case "CONCLUÍDO":
      return "Concluído";
    case "CONFIRMADO":
      return "Confirmado";
    case "FINALIZADO":
    case "FINALIZADO_CLIENTE":
      return "Finalizado";
    case "PAGO":
      return "Pago";
    case "AVALIADO":
      return "Avaliado";
    case "CANCELADO":
      return "Cancelado";
    case "RECUSADO":
      return "Recusado";
    default:
      return status || "Status";
  }
}

function variantFor(status: string): StatusVariant {
  if (status === "CANCELADO" || status === "RECUSADO") return "danger";
  if (status === "CONCLUIDO" || status === "CONCLUÍDO") return "warning";
  if (
    status === "CONFIRMADO" ||
    status === "FINALIZADO" ||
    status === "FINALIZADO_CLIENTE" ||
    status === "PAGO" ||
    status === "AVALIADO"
  ) {
    return "success";
  }
  return "neutral";
}

function categoriaLabelFor(servico: ServicoRaw): string {
  const tipo = statusUp(servico.tipo);
  if (tipo === "MONTADOR") return "Montador";
  if (tipo === "BABA") return "Babá";
  if (tipo === "COZINHEIRA") return "Cozinheira";
  if (tipo === "FAXINA") return "Diarista";
  return "Serviço";
}

function formatDate(value?: string | null): string {
  if (!value) return "Data a combinar";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data a combinar";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTurno(value?: string | null): string {
  const turno = statusUp(value);
  if (turno === "MANHA") return "Manhã";
  if (turno === "TARDE") return "Tarde";
  if (turno === "NOITE") return "Noite";
  return "";
}

function formatLocal(servico: ServicoRaw): string {
  const parts = [servico.bairro, servico.cidade, servico.uf]
    .filter((part): part is string => Boolean(part && part.trim()))
    .map((part) => part.trim());
  if (parts.length === 0) return "Local a definir";
  return parts.join(", ");
}

function formatPreco(value?: number | null): string | undefined {
  if (value == null || Number.isNaN(value)) return undefined;
  try {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });
  } catch {
    return `R$ ${value}`;
  }
}

function mapServico(raw: ServicoRaw): HistoricoItem {
  const status = statusUp(raw.status);
  const profissional = raw.diarista ?? raw.montador;
  const dataBase = formatDate(raw.data ?? raw.createdAt);
  const turno = formatTurno(raw.turno);

  return {
    id: raw.id,
    nome: profissional?.nome ?? "Profissional",
    categoriaLabel: categoriaLabelFor(raw),
    statusLabel: statusLabel(status),
    statusVariant: variantFor(status),
    dataLabel: turno ? `${dataBase} • ${turno}` : dataBase,
    localLabel: formatLocal(raw),
    precoLabel: formatPreco(raw.precoFinal),
  };
}

function HistoricoCard({
  item,
  onPress,
}: {
  item: HistoricoItem;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.card, pressed && { opacity: 0.88 }]}
    >
      <View style={s.cardHeader}>
        <View style={s.cardHeaderText}>
          <Text style={s.cardName} numberOfLines={1}>
            {item.nome}
          </Text>
          <Text style={s.cardCategoria} numberOfLines={1}>
            {item.categoriaLabel}
          </Text>
        </View>
        <View style={[s.statusBadge, s[`status_${item.statusVariant}` as const]]}>
          <Text
            style={[
              s.statusBadgeText,
              s[`statusText_${item.statusVariant}` as const],
            ]}
            numberOfLines={1}
          >
            {item.statusLabel}
          </Text>
        </View>
      </View>

      <View style={s.cardRow}>
        <AppIcon name="Calendar" size={13} color={colors.textMuted} strokeWidth={2} />
        <Text style={s.cardRowText} numberOfLines={1}>
          {item.dataLabel}
        </Text>
      </View>

      <View style={s.cardRow}>
        <AppIcon name="MapPin" size={13} color={colors.textMuted} strokeWidth={2} />
        <Text style={s.cardRowText} numberOfLines={1}>
          {item.localLabel}
        </Text>
      </View>

      {item.precoLabel ? (
        <View style={s.cardFooter}>
          <Text style={s.precoLabel}>Valor final</Text>
          <Text style={s.precoValue}>{item.precoLabel}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function HistoricoEmpregadorScreen() {
  const navigation = useNavigation<Navigation>();
  const [servicos, setServicos] = useState<HistoricoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const res = await api.get<MinhasResponse>("/api/servicos/minhas");
      const raw: ServicoRaw[] = Array.isArray(res.data?.servicos)
        ? res.data!.servicos!
        : [];

      const filtrados = raw
        .filter((item) => STATUS_HISTORICO.includes(statusUp(item.status)))
        .map(mapServico);

      setServicos(filtrados);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(
        err?.response?.data?.error ??
          err?.message ??
          "Não foi possível carregar o histórico.",
      );
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const content = useMemo(() => {
    if (loading && !refreshing) {
      return (
        <View style={s.contentInner}>
          <DSkeletonCard count={3} height={120} />
        </View>
      );
    }
    if (error) {
      return (
        <View style={s.contentInner}>
          <DErrorState message={error} onRetry={() => carregar()} />
        </View>
      );
    }
    if (servicos.length === 0) {
      return (
        <View style={s.contentInner}>
          <DEmptyState
            icon="Clock"
            title="Nenhum histórico ainda"
            subtitle="Serviços concluídos ou cancelados aparecerão aqui."
          />
        </View>
      );
    }
    return (
      <FlatList
        data={servicos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <HistoricoCard
            item={item}
            onPress={() =>
              navigation.navigate("EmpregadorDetalhe", { servicoId: item.id })
            }
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        contentContainerStyle={s.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => carregar(true)}
            tintColor={colors.primary}
          />
        }
      />
    );
  }, [carregar, error, loading, navigation, refreshing, servicos]);

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <DScreenHeader title="Histórico" onBack={() => navigation.goBack()} />
      <View style={s.root}>{content}</View>
    </SafeAreaView>
  );
}

export default HistoricoEmpregadorScreen;

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  root: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
  },
  listContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: 120,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 8,
    ...shadows.soft,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  cardHeaderText: {
    flex: 1,
    gap: 2,
  },
  cardName: {
    ...typography.bodyMedium,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  cardCategoria: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "500",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardRowText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  precoLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  precoValue: {
    ...typography.bodySmMedium,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusBadgeText: {
    ...typography.caption,
    fontWeight: "700",
    fontSize: 11,
  },
  status_success: {
    backgroundColor: colors.successSoft,
  },
  status_warning: {
    backgroundColor: colors.warningSoft,
  },
  status_danger: {
    backgroundColor: colors.dangerSoft,
  },
  status_neutral: {
    backgroundColor: colors.lavender,
  },
  statusText_success: {
    color: colors.success,
  },
  statusText_warning: {
    color: colors.warningDark,
  },
  statusText_danger: {
    color: colors.danger,
  },
  statusText_neutral: {
    color: colors.textSecondary,
  },
});
