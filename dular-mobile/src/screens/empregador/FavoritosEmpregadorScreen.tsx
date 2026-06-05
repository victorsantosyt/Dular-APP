import { useEffect, useState, useCallback } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";

import { AppIcon, DAvatar, DButton, DEmptyState, DScreenHeader, DSkeletonCard } from "@/components/ui";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import { api } from "@/lib/api";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";

type Navigation = BottomTabNavigationProp<EmpregadorTabParamList>;

interface Favorito {
  id: string;
  tipo: "DIARISTA" | "MONTADOR";
  userId: string;
  nome: string;
  avatarUrl?: string | null;
  rating?: number | null;
  totalServicos?: number | null;
  cidade?: string | null;
  estado?: string | null;
  bairros?: string[];
  especialidades?: string[];
  precoLabel?: string | null;
  verificado?: boolean;
  profileCompleto?: boolean;
}

interface FavoritosResponse {
  ok: boolean;
  favoritos: Favorito[];
}

function FavoritoCard({ favorito }: { favorito: Favorito }) {
  const navigation = useNavigation<Navigation>();
  const initials = favorito.nome.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const localizacao = [favorito.cidade, favorito.estado].filter(Boolean).join(", ") || "Localização não informada";
  const nota = favorito.rating ? favorito.rating.toFixed(1).replace(".", ",") : "--";
  const servicos = favorito.totalServicos ? `${favorito.totalServicos} serviços` : "Novo";
  const tipoLabel = favorito.tipo === "DIARISTA" ? "Diarista" : "Montador";

  const handlePress = () => {
    if (favorito.tipo === "MONTADOR") {
      navigation.navigate("MontadorPublicProfile", {
        montadorId: favorito.userId,
        montadorUserId: favorito.userId,
        nome: favorito.nome,
        rating: favorito.rating ?? undefined,
        especialidades: favorito.especialidades,
        cidade: favorito.cidade,
        estado: favorito.estado,
        avatarUrl: favorito.avatarUrl,
      });
      return;
    }
    navigation.navigate("DiaristaProfile", {
      diaristaId: favorito.userId,
      nome: favorito.nome,
      categoriaInicial: "diarista",
    });
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [s.card, pressed && { opacity: 0.88 }]}
    >
      <View style={s.avatarWrap}>
        <DAvatar size="md" uri={favorito.avatarUrl ?? undefined} initials={initials} />
      </View>

      <View style={s.cardContent}>
        <View style={s.nameRow}>
          <Text style={s.name} numberOfLines={1}>
            {favorito.nome}
          </Text>
          {favorito.verificado ? (
            <AppIcon name="Diamond" size={13} color={colors.success} strokeWidth={2.4} />
          ) : null}
        </View>

        <View style={s.typeBadge}>
          <AppIcon name={favorito.tipo === "DIARISTA" ? "BrushCleaning" : "Wrench"} size={9} color={colors.primary} strokeWidth={2} />
          <Text style={s.typeBadgeText}>{tipoLabel}</Text>
        </View>

        <Text style={s.location} numberOfLines={1}>
          {localizacao}
        </Text>

        {(favorito.especialidades && favorito.especialidades.length > 0) || favorito.rating ? (
          <View style={s.ratingRow}>
            {favorito.rating ? (
              <>
                <AppIcon name="Star" size={12} color={colors.warning} strokeWidth={2.3} />
                <Text style={s.ratingText}>{nota}</Text>
                <Text style={s.metaSep}>•</Text>
              </>
            ) : null}
            <Text style={s.metaText}>{servicos}</Text>
          </View>
        ) : null}
      </View>

      <View style={s.rightContent}>
        {favorito.precoLabel ? (
          <Text style={s.priceLabel} numberOfLines={1}>
            {favorito.precoLabel}
          </Text>
        ) : null}
        <View style={s.profileBtn}>
          <Text style={s.profileBtnText}>Ver perfil</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function FavoritosEmpregadorScreen() {
  const navigation = useNavigation<Navigation>();
  const [favoritos, setFavoritos] = useState<Favorito[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchFavoritos = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get<FavoritosResponse>("/api/empregador/favoritos");
      if (response.data?.ok && Array.isArray(response.data.favoritos)) {
        setFavoritos(response.data.favoritos);
      } else {
        setFavoritos([]);
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : (err as any)?.response?.data?.message ?? "Erro ao carregar favoritos";
      setError(message);
      setFavoritos([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchFavoritos();
  }, [fetchFavoritos]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchFavoritos();
  }, [fetchFavoritos]);

  const handleRetry = useCallback(() => {
    setLoading(true);
    fetchFavoritos();
  }, [fetchFavoritos]);

  if (loading && !isRefreshing) {
    return (
      <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
        <DScreenHeader
          title="Favoritos"
          onBack={() => navigation.goBack()}
        />
        <View style={s.content}>
          <DSkeletonCard count={3} height={88} />
        </View>
      </SafeAreaView>
    );
  }

  if (error && favoritos.length === 0) {
    return (
      <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
        <DScreenHeader
          title="Favoritos"
          onBack={() => navigation.goBack()}
        />
        <View style={s.errorContent}>
          <DEmptyState
            icon="AlertCircle"
            title="Erro ao carregar"
            subtitle={error}
          />
          <View style={s.errorActions}>
            <DButton
              variant="primary"
              size="md"
              label="Tentar novamente"
              onPress={handleRetry}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (favoritos.length === 0) {
    return (
      <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
        <DScreenHeader
          title="Favoritos"
          onBack={() => navigation.goBack()}
        />
        <View style={s.content}>
          <DEmptyState
            icon="Heart"
            title="Nenhum favorito ainda"
            subtitle="Quando você favoritar profissionais, eles aparecerão aqui."
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <DScreenHeader
        title="Favoritos"
        onBack={() => navigation.goBack()}
      />
      <FlatList
        data={favoritos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <FavoritoCard favorito={item} />}
        contentContainerStyle={s.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        onRefresh={handleRefresh}
        refreshing={isRefreshing}
      />
    </SafeAreaView>
  );
}

export default FavoritosEmpregadorScreen;

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 16,
  },
  errorContent: {
    flex: 1,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 16,
    justifyContent: "space-between",
    paddingBottom: 32,
  },
  errorActions: {
    gap: 8,
  },
  listContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 16,
    paddingBottom: 118,
    gap: 8,
  },
  card: {
    minHeight: 88,
    borderRadius: 15,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    ...shadows.soft,
  },
  avatarWrap: {
    width: 50,
    height: 50,
  },
  cardContent: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  name: {
    flexShrink: 1,
    color: colors.textPrimary,
    ...typography.bodySmMedium,
    fontWeight: "700",
  },
  typeBadge: {
    alignSelf: "flex-start",
    minHeight: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.lavender,
    paddingHorizontal: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  typeBadgeText: {
    color: colors.primary,
    ...typography.caption,
    fontWeight: "700",
  },
  location: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: "500",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: "600",
  },
  metaText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: "500",
  },
  metaSep: {
    color: colors.textMuted,
    ...typography.caption,
    fontWeight: "700",
  },
  rightContent: {
    width: 82,
    alignItems: "flex-end",
    alignSelf: "stretch",
    justifyContent: "flex-start",
    gap: 8,
    paddingVertical: 4,
  },
  priceLabel: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: "500",
    maxWidth: 80,
  },
  profileBtn: {
    minHeight: 31,
    minWidth: 78,
    borderRadius: 11,
    borderWidth: 1.3,
    borderColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  profileBtnText: {
    color: colors.primary,
    ...typography.caption,
    fontWeight: "700",
  },
});
