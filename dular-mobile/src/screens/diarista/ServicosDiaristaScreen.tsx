import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppIcon, type AppIconName, DBadge, DCard } from "@/components/ui";
import { colors, radius, spacing, typography } from "@/theme";
import { useGenderTheme } from "@/hooks/useProfileTheme";
import type { ProfileTheme } from "@/theme/profileTheme";
import type { DiaristaTabParamList } from "@/navigation/DiaristaNavigator";
import {
  useAgendamentosDiarista,
  type AgendamentoDiarista,
  type StatusDiarista,
} from "@/hooks/useAgendamentosDiarista";

/**
 * ServicosDiaristaScreen — tela do botão "Serviços" (tab central).
 *
 * Mostra os serviços que a profissional foi solicitada, agrupados por categoria
 * (Diarista, Babá, Cozinheira, Passar roupa), com a categoria/subtipo de cada um.
 */

type Navigation = BottomTabNavigationProp<DiaristaTabParamList>;
type BadgeType = "default" | "success" | "warning" | "error" | "info" | "accent";

const TIPO_META: Record<string, { label: string; icon: AppIconName }> = {
  FAXINA: { label: "Diarista", icon: "BrushCleaning" },
  BABA: { label: "Babá", icon: "Baby" },
  COZINHEIRA: { label: "Cozinheira", icon: "ChefHat" },
  PASSA_ROUPA: { label: "Passar roupa", icon: "Shirt" },
};

const CATEGORIA_LABEL: Record<string, string> = {
  FAXINA_LEVE: "Limpeza leve",
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

const TIPO_ORDER = ["FAXINA", "BABA", "COZINHEIRA", "PASSA_ROUPA"];

type ServicoView = "ativos" | "historico";
const STATUS_HISTORICO: StatusDiarista[] = ["finalizado", "cancelado"];

function tipoMeta(tipo: string): { label: string; icon: AppIconName } {
  return TIPO_META[tipo] ?? { label: tipo || "Outros", icon: "Sparkles" };
}

function categoriaLabel(categoria: string | null, tipo?: string): string {
  if (categoria) return CATEGORIA_LABEL[categoria] ?? categoria;
  // Sem subtipo (intensidade) definido → mostra o tipo do serviço (ex.: "Diarista").
  if (tipo) return tipoMeta(tipo).label;
  return "Categoria não especificada";
}

function statusBadge(status: StatusDiarista): { label: string; type: BadgeType } {
  switch (status) {
    case "pendente":
      return { label: "Pendente", type: "warning" };
    case "confirmado":
      return { label: "Confirmado", type: "success" };
    case "andamento":
      return { label: "Em andamento", type: "info" };
    case "finalizado":
      return { label: "Finalizado", type: "default" };
    case "cancelado":
      return { label: "Cancelado", type: "error" };
    default:
      return { label: status, type: "default" };
  }
}

function ServicoCard({
  item,
  theme,
  onPress,
}: {
  item: AgendamentoDiarista;
  theme: ProfileTheme;
  onPress: () => void;
}) {
  const badge = statusBadge(item.status);
  const s = makeStyles(theme);
  return (
    <DCard style={s.card} onPress={onPress}>
      <View style={s.cardRow}>
        <View style={s.cardInfo}>
          <Text style={s.categoria}>{categoriaLabel(item.categoria, item.tipo)}</Text>
          <View style={s.metaRow}>
            <AppIcon name="UserRound" size={13} color={colors.textSecondary} strokeWidth={2.2} />
            <Text style={s.metaText} numberOfLines={1}>{item.nomeCliente}</Text>
          </View>
          <View style={s.metaRow}>
            <AppIcon name="Calendar" size={13} color={colors.textSecondary} strokeWidth={2.2} />
            <Text style={s.metaText} numberOfLines={1}>
              {item.data}
              {item.hora ? ` · ${item.hora}` : ""}
            </Text>
          </View>
        </View>
        <View style={s.cardRight}>
          <DBadge type={badge.type} label={badge.label} />
          <AppIcon name="ChevronRight" size={18} color={colors.textMuted} />
        </View>
      </View>
    </DCard>
  );
}

export function ServicosDiaristaScreen() {
  const navigation = useNavigation<Navigation>();
  const theme = useGenderTheme("DIARISTA");
  const s = makeStyles(theme);
  const { agendamentos, loading, error, refetch } = useAgendamentosDiarista();
  const [view, setView] = useState<ServicoView>("ativos");

  // Histórico = serviços finalizados/cancelados; Ativos = o restante.
  const visiveis = useMemo(() => {
    const isHist = (a: AgendamentoDiarista) => STATUS_HISTORICO.includes(a.status);
    return agendamentos.filter((a) => (view === "historico" ? isHist(a) : !isHist(a)));
  }, [agendamentos, view]);

  const groups = useMemo(() => {
    const byTipo = new Map<string, AgendamentoDiarista[]>();
    for (const a of visiveis) {
      const key = a.tipo || "OUTROS";
      const list = byTipo.get(key) ?? [];
      list.push(a);
      byTipo.set(key, list);
    }
    const known = TIPO_ORDER.filter((t) => byTipo.has(t)).map((t) => ({ tipo: t, items: byTipo.get(t)! }));
    const others = [...byTipo.keys()]
      .filter((k) => !TIPO_ORDER.includes(k))
      .map((k) => ({ tipo: k, items: byTipo.get(k)! }));
    return [...known, ...others];
  }, [visiveis]);

  const abrir = (id: string) => navigation.navigate("DiaristaDetalhe", { servicoId: id });

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <Text style={s.title}>Serviços</Text>
          <View style={s.headerIcon}>
            <AppIcon name="BrushCleaning" size={22} color={theme.primary} strokeWidth={2.1} />
          </View>
        </View>
        <Text style={s.subtitle}>Suas solicitações por categoria</Text>

        <View style={s.segment}>
          {(["ativos", "historico"] as ServicoView[]).map((v) => {
            const active = view === v;
            return (
              <Pressable
                key={v}
                onPress={() => setView(v)}
                style={[s.segmentItem, active && { backgroundColor: theme.primarySoft }]}
              >
                <AppIcon
                  name={v === "ativos" ? "Sparkles" : "Clock3"}
                  size={15}
                  color={active ? theme.primary : colors.textMuted}
                  strokeWidth={2.2}
                />
                <Text style={[s.segmentText, active && { color: theme.primary }]}>
                  {v === "ativos" ? "Ativos" : "Histórico"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {loading && agendamentos.length === 0 ? (
        <View style={s.centerState}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : error ? (
        <View style={s.centerState}>
          <Text style={s.emptyText}>Erro ao carregar serviços</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refetch} tintColor={theme.primary} colors={[theme.primary]} />
          }
        >
          {groups.length === 0 ? (
            <View style={s.centerState}>
              <View style={s.emptyIconBox}>
                <AppIcon name="BrushCleaning" size={30} color={theme.primary} strokeWidth={2} />
              </View>
              <Text style={s.emptyTitle}>
                {view === "historico" ? "Sem histórico ainda" : "Nenhum serviço solicitado"}
              </Text>
              <Text style={s.emptyText}>
                {view === "historico"
                  ? "Serviços finalizados ou cancelados ficam guardados aqui para você revisar."
                  : "Quando empregadores solicitarem seus serviços, eles aparecem aqui organizados por categoria."}
              </Text>
            </View>
          ) : (
            groups.map((group) => {
              const meta = tipoMeta(group.tipo);
              return (
                <View key={group.tipo} style={s.group}>
                  <View style={s.groupHeader}>
                    <View style={s.groupIcon}>
                      <AppIcon name={meta.icon} size={18} color={theme.primary} strokeWidth={2.2} />
                    </View>
                    <Text style={s.groupTitle}>{meta.label}</Text>
                    <View style={s.groupCount}>
                      <Text style={s.groupCountText}>{group.items.length}</Text>
                    </View>
                  </View>
                  <View style={s.groupList}>
                    {group.items.map((item) => (
                      <ServicoCard key={item.id} item={item} theme={theme} onPress={() => abrir(item.id)} />
                    ))}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

export default ServicosDiaristaScreen;

function makeStyles(theme: ProfileTheme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.screenPadding, paddingTop: 10, paddingBottom: 4 },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    headerIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primarySoft,
    },
    title: { ...typography.h2, color: colors.textPrimary },
    subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

    segment: {
      flexDirection: "row",
      gap: 4,
      marginTop: 12,
      padding: 4,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    segmentItem: {
      flex: 1,
      minHeight: 36,
      borderRadius: radius.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    segmentText: { ...typography.caption, fontWeight: "700", color: colors.textMuted },

    scroll: { padding: spacing.screenPadding, paddingBottom: 122, gap: 18 },

    group: { gap: 10 },
    groupHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    groupIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primarySoft,
    },
    groupTitle: { flex: 1, ...typography.bodyMedium, fontWeight: "800", color: colors.textPrimary },
    groupCount: {
      minWidth: 24,
      height: 24,
      paddingHorizontal: 7,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primarySoft,
    },
    groupCountText: { ...typography.caption, fontWeight: "800", color: theme.textAccent },
    groupList: { gap: 8 },

    card: { padding: 12 },
    cardRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    cardInfo: { flex: 1, gap: 4 },
    categoria: { ...typography.bodySmMedium, fontWeight: "700", color: colors.textPrimary },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    metaText: { flex: 1, ...typography.caption, color: colors.textSecondary, fontWeight: "500" },
    cardRight: { alignItems: "flex-end", gap: 8 },

    centerState: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing["3xl"], gap: 8 },
    emptyIconBox: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primarySoft,
      marginBottom: 4,
    },
    emptyTitle: { ...typography.bodyMedium, fontWeight: "800", color: colors.textPrimary },
    emptyText: { ...typography.bodySm, color: colors.textSecondary, textAlign: "center", fontWeight: "500" },
  });
}
