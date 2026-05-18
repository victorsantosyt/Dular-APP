/**
 * ProfissionaisDestaqueScreen
 *
 * Linkada do "Ver todas" da seção "Profissionais em destaque" da Buscar.
 *
 * Como não há (ainda) um critério de destaque no backend, reaproveitamos o
 * mesmo hook `useBuscar` e ordenamos os retornos por `rating`/`notaMedia` real
 * — quando todos os ratings forem zero, a ordem original é mantida.
 *
 * NÃO usar mocks. Sem dados reais → empty state.
 */
import { useEffect, useMemo, useState } from "react";
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
  type AppIconName,
  DAvatar,
  DEmptyState,
  DErrorState,
  DScreenHeader,
  DSkeletonCard,
} from "@/components/ui";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import { useAuth } from "@/stores/authStore";
import { useBuscar, type ApiDiarista } from "@/hooks/useBuscar";
import {
  MONTADOR_ESPECIALIDADES as MONTADOR_LABELS_PUBLICOS,
  type MontadorItem,
} from "@/types/montador";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";

type Navigation = BottomTabNavigationProp<EmpregadorTabParamList>;

const MONTADOR_LABELS = Object.fromEntries(
  MONTADOR_LABELS_PUBLICOS.map((item) => [item.id, item.label]),
) as Record<string, string>;

type DestaqueItem = {
  id: string;
  userId: string;
  tipo: "DIARISTA" | "MONTADOR";
  nome: string;
  categoriaLabel: string;
  categoriaIcon: AppIconName;
  localizacao: string;
  notaValor: number;
  notaLabel: string;
  experienciaLabel: string;
  verificado: boolean;
  avatarUrl?: string | null;
  especialidades?: string[];
  cidade?: string | null;
  estado?: string | null;
  rating?: number;
};

function diaristaToItem(d: ApiDiarista, cidade: string, bairro: string): DestaqueItem {
  const local = bairro && cidade ? `${bairro}, ${cidade}` : cidade || "--";
  return {
    id: d.userId,
    userId: d.userId,
    tipo: "DIARISTA",
    nome: d.user?.nome ?? "Profissional",
    categoriaLabel: "Diarista",
    categoriaIcon: "BrushCleaning",
    localizacao: local,
    notaValor: d.notaMedia ?? 0,
    notaLabel: d.notaMedia > 0 ? d.notaMedia.toFixed(1).replace(".", ",") : "--",
    experienciaLabel:
      d.totalServicos > 0 ? `${d.totalServicos} serviços` : "Novo",
    verificado: d.verificacao === "VERIFICADO",
    avatarUrl: d.fotoUrl,
  };
}

function montadorToItem(m: MontadorItem): DestaqueItem {
  const cidadeEstado = [m.cidade, m.estado].filter(Boolean).join(", ");
  const principais = (m.especialidades ?? [])
    .map((item) => MONTADOR_LABELS[item] ?? item)
    .slice(0, 2)
    .join(" • ");
  return {
    id: m.id,
    userId: m.userId ?? m.user.id,
    tipo: "MONTADOR",
    nome: m.user.nome ?? "Montador",
    categoriaLabel: "Montador",
    categoriaIcon: "Wrench",
    localizacao: cidadeEstado || "Localização a confirmar",
    notaValor: m.rating ?? 0,
    notaLabel: m.rating > 0 ? m.rating.toFixed(1).replace(".", ",") : "--",
    experienciaLabel:
      principais ||
      (m.totalServicos > 0
        ? `${m.totalServicos} serviços`
        : "Perfil profissional completo"),
    verificado: m.verificado,
    avatarUrl: m.fotoPerfil ?? m.user.avatarUrl,
    especialidades: m.especialidades,
    cidade: m.cidade,
    estado: m.estado,
    rating: m.rating,
  };
}

function DestaqueCard({
  item,
  onPress,
}: {
  item: DestaqueItem;
  onPress: () => void;
}) {
  const initials = item.nome
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <View style={s.card}>
      <View style={s.avatarWrap}>
        <DAvatar size="md" uri={item.avatarUrl ?? undefined} initials={initials} />
        {item.verificado ? (
          <View style={s.verifiedDot}>
            <AppIcon name="Diamond" size={10} color={colors.white} strokeWidth={2.5} />
          </View>
        ) : null}
      </View>

      <View style={s.cardCenter}>
        <Text style={s.cardName} numberOfLines={1}>
          {item.nome}
        </Text>
        <View style={s.catBadge}>
          <AppIcon
            name={item.categoriaIcon}
            size={10}
            color={colors.primary}
            strokeWidth={2}
          />
          <Text style={s.catBadgeText}>{item.categoriaLabel}</Text>
        </View>
        <View style={s.metaRow}>
          <AppIcon name="MapPin" size={11} color={colors.textMuted} strokeWidth={2} />
          <Text style={s.metaText} numberOfLines={1}>
            {item.localizacao}
          </Text>
        </View>
        <View style={s.metaRow}>
          <AppIcon name="Star" size={11} color={colors.warning} strokeWidth={2.3} />
          <Text style={s.metaText}>{item.notaLabel}</Text>
          <Text style={s.metaSep}>•</Text>
          <Text style={s.metaText}>{item.experienciaLabel}</Text>
        </View>
      </View>

      <Pressable
        onPress={onPress}
        style={({ pressed }) => [s.profileBtn, pressed && { opacity: 0.78 }]}
      >
        <Text style={s.profileBtnText}>Ver perfil</Text>
      </Pressable>
    </View>
  );
}

export function ProfissionaisDestaqueScreen() {
  const navigation = useNavigation<Navigation>();
  const user = useAuth((state) => state.user);
  const cidade = (user?.cidadeAtual ?? user?.cidade ?? "").trim();
  const uf = (user?.estadoAtual ?? user?.estado ?? "").trim();
  const bairro = (user?.bairroAtual ?? "").trim();

  const { profissionais, montadores, loading, error, buscar } = useBuscar();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (cidade && uf) {
      buscar({ cidade, uf, bairro });
    }
  }, [buscar, cidade, uf, bairro]);

  const items: DestaqueItem[] = useMemo(() => {
    if (!cidade || !uf) return [];
    const list = [
      ...profissionais.map((p) => diaristaToItem(p, cidade, bairro)),
      ...montadores.map(montadorToItem),
    ];
    // Ordenação por nota real desc; sem nota fica no final mantendo ordem original.
    return list.sort((a, b) => b.notaValor - a.notaValor);
  }, [bairro, cidade, montadores, profissionais, uf]);

  const handleRefresh = async () => {
    if (!cidade || !uf) return;
    setRefreshing(true);
    try {
      await buscar({ cidade, uf, bairro });
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpen = (item: DestaqueItem) => {
    if (item.tipo === "MONTADOR") {
      navigation.navigate("MontadorPublicProfile", {
        montadorId: item.id,
        montadorUserId: item.userId,
        nome: item.nome,
        rating: item.rating,
        especialidades: item.especialidades,
        cidade: item.cidade,
        estado: item.estado,
        avatarUrl: item.avatarUrl,
      });
      return;
    }
    navigation.navigate("DiaristaProfile", {
      diaristaId: item.userId,
      nome: item.nome,
      categoriaInicial: "diarista",
    });
  };

  let content: React.ReactNode;
  if (!cidade || !uf) {
    content = (
      <View style={s.contentPadding}>
        <DEmptyState
          icon="MapPin"
          title="Defina sua região para ver destaques"
          subtitle="Informe sua localização atual para destacar profissionais próximos."
          action="Ir para Buscar"
          onAction={() => navigation.navigate("Buscar")}
        />
      </View>
    );
  } else if (loading && !refreshing) {
    content = (
      <View style={s.contentPadding}>
        <DSkeletonCard count={4} height={104} />
      </View>
    );
  } else if (error) {
    content = (
      <View style={s.contentPadding}>
        <DErrorState
          message={error}
          onRetry={() => buscar({ cidade, uf, bairro })}
        />
      </View>
    );
  } else if (items.length === 0) {
    content = (
      <View style={s.contentPadding}>
        <DEmptyState
          icon="Sparkles"
          title="Nenhum profissional em destaque"
          subtitle="Ainda não há profissionais com avaliações na sua região."
        />
      </View>
    );
  } else {
    content = (
      <FlatList
        data={items}
        keyExtractor={(item) => `${item.tipo}-${item.id}`}
        renderItem={({ item }) => (
          <DestaqueCard item={item} onPress={() => handleOpen(item)} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        contentContainerStyle={s.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      />
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <DScreenHeader
        title="Profissionais em destaque"
        onBack={() => navigation.goBack()}
      />
      <View style={s.root}>{content}</View>
    </SafeAreaView>
  );
}

export default ProfissionaisDestaqueScreen;

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  root: {
    flex: 1,
  },
  contentPadding: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
  },
  listContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: 120,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 2,
    gap: 10,
    ...shadows.soft,
  },
  avatarWrap: {
    position: "relative",
  },
  verifiedDot: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
  },
  cardCenter: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  cardName: {
    color: colors.textPrimary,
    ...typography.bodySmMedium,
    fontWeight: "700",
  },
  catBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: colors.lavender,
    borderRadius: radius.pill,
  },
  catBadgeText: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.primary,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    ...typography.caption,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  metaSep: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "700",
  },
  profileBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1.3,
    borderColor: colors.primaryLight,
    backgroundColor: colors.surface,
  },
  profileBtnText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "700",
  },
});
