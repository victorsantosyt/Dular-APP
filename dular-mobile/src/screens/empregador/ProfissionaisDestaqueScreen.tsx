/**
 * ProfissionaisDestaqueScreen ("Ver todas" de "Profissionais em destaque")
 *
 * Reusa o hook `useBuscar` e o card ÚNICO `ProfissionalCard`. "Em destaque"
 * ordena por nota real desc (quando todos forem 0, mantém a ordem original).
 * Sem mocks: sem dados reais → empty state.
 */
import { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";

import {
  DEmptyState,
  DErrorState,
  DScreenHeader,
  DSkeletonCard,
  ProfissionalCard,
  formatValorDiarista,
  formatValorMontador,
  type ProfissionalCardData,
} from "@/components/ui";
import { colors, spacing } from "@/theme";
import { CATEGORIA_BY_KEY } from "@/constants/categorias";
import { useAuth } from "@/stores/authStore";
import { useFavoritos } from "@/hooks/useFavoritos";
import { useBuscar, type ApiDiarista } from "@/hooks/useBuscar";
import type { MontadorItem } from "@/types/montador";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";

type Navigation = BottomTabNavigationProp<EmpregadorTabParamList>;

const DIARISTA_CAT = CATEGORIA_BY_KEY.diarista;
const MONTADOR_CAT = CATEGORIA_BY_KEY.montador;

// Card data + campos extras usados só na navegação para o perfil público.
type ListItem = ProfissionalCardData & {
  especialidades?: string[];
  estado?: string | null;
};

function diaristaToItem(d: ApiDiarista, cidade: string, bairro: string): ListItem {
  return {
    id: d.userId,
    userId: d.userId,
    tipo: "DIARISTA",
    nome: d.user?.nome ?? "Profissional",
    categoria: DIARISTA_CAT.label,
    categoriaIcon: DIARISTA_CAT.icon,
    categoriaColor: DIARISTA_CAT.fg,
    categoriaBg: DIARISTA_CAT.bg,
    avatarUrl: d.fotoUrl ?? d.user?.avatarUrl ?? null,
    cidade: cidade || null,
    bairro: bairro || null,
    valorLabel: formatValorDiarista(d.precoLeve),
    nota: d.notaMedia,
  };
}

function montadorToItem(m: MontadorItem): ListItem {
  return {
    id: m.id,
    userId: m.userId ?? m.user.id,
    tipo: "MONTADOR",
    nome: m.user.nome ?? "Montador",
    categoria: MONTADOR_CAT.label,
    categoriaIcon: MONTADOR_CAT.icon,
    categoriaColor: MONTADOR_CAT.fg,
    categoriaBg: MONTADOR_CAT.bg,
    avatarUrl: m.fotoPerfil ?? m.user.avatarUrl,
    cidade: m.cidade ?? null,
    bairro: m.bairros?.[0] ?? null,
    valorLabel: formatValorMontador(m),
    nota: m.rating,
    especialidades: m.especialidades,
    estado: m.estado,
  };
}

export function ProfissionaisDestaqueScreen() {
  const navigation = useNavigation<Navigation>();
  const user = useAuth((state) => state.user);
  const cidade = (user?.cidadeAtual ?? user?.cidade ?? "").trim();
  const uf = (user?.estadoAtual ?? user?.estado ?? "").trim();
  const bairro = (user?.bairroAtual ?? "").trim();

  const { profissionais, montadores, loading, error, buscar } = useBuscar();
  const { isFavorito, toggle: toggleFavorito } = useFavoritos();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (cidade && uf) {
      buscar({ cidade, uf, bairro });
    }
  }, [buscar, cidade, uf, bairro]);

  const items: ListItem[] = useMemo(() => {
    if (!cidade || !uf) return [];
    const list = [
      ...profissionais.map((p) => diaristaToItem(p, cidade, bairro)),
      ...montadores.map(montadorToItem),
    ];
    // Ordenação por nota real desc; sem nota fica no final mantendo ordem original.
    return list.sort((a, b) => (b.nota ?? 0) - (a.nota ?? 0));
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

  const handleToggleFavorito = async (item: ListItem) => {
    try {
      await toggleFavorito(item.userId, item.tipo);
    } catch {
      Alert.alert("Não foi possível atualizar", "Tente novamente em instantes. Verifique sua conexão.");
    }
  };

  const handleOpen = (item: ListItem) => {
    if (item.tipo === "MONTADOR") {
      navigation.navigate("MontadorPublicProfile", {
        montadorId: item.id,
        montadorUserId: item.userId,
        nome: item.nome,
        rating: item.nota,
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
        <DErrorState message={error} onRetry={() => buscar({ cidade, uf, bairro })} />
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
          <ProfissionalCard
            data={item}
            favorito={isFavorito(item.userId, item.tipo)}
            onToggleFavorito={() => handleToggleFavorito(item)}
            onPress={() => handleOpen(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        contentContainerStyle={s.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      />
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <DScreenHeader title="Profissionais em destaque" onBack={() => navigation.goBack()} />
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
});
