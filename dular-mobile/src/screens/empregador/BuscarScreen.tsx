import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import {
  AppIcon,
  type AppIconName,
  DButton,
  DSkeletonCard,
  ProfissionalCard,
  formatValorDiarista,
  formatValorMontador,
  type ProfissionalCardData,
} from "@/components/ui";
import { LocationPermissionCard } from "@/components/location/LocationPermissionCard";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";
import { useBuscar, type ApiDiarista } from "@/hooks/useBuscar";
import { CATEGORIAS as CATEGORIAS_FONTE, CATEGORIAS_DIARISTA, CATEGORIA_BY_KEY, type CategoriaKey } from "@/constants/categorias";
import { useFavoritos } from "@/hooks/useFavoritos";
import { salvarLocalizacaoAtual } from "@/api/localizacaoApi";
import { useAuth } from "@/stores/authStore";
import { useCurrentRegion, type CurrentRegion } from "@/hooks/useCurrentRegion";
import type { MontadorItem } from "@/types/montador";

type Navigation = BottomTabNavigationProp<EmpregadorTabParamList>;
type BuscarRoute = RouteProp<EmpregadorTabParamList, "Buscar">;

type CategoriaCardItem = {
  key: CategoriaKey;
  icon: AppIconName;
  title: string;
  subtitle: string;
  bg: string;
  iconColor: string;
  imageSource?: ImageSourcePropType;
  imageStyle?: {
    width: number;
    height: number;
    right?: number;
    left?: number;
    bottom?: number;
  };
};

type Profissional = {
  id: string;
  userId: string;
  tipo: "DIARISTA" | "MONTADOR";
  nome: string;
  categoria: string;
  categoriaIcon: AppIconName;
  categoriaKey: CategoriaKey;
  // Usado só no filtro de busca por texto — não entra no layout do card.
  localizacao: string;
  avatarUrl?: string | null;
  especialidades?: string[];
  cidade?: string | null;
  estado?: string | null;
  rating?: number;
  // Campos derivados para o card único (ProfissionalCard).
  categoriaColor?: string;
  categoriaBg?: string;
  valorLabel?: string;
  notaNum?: number;
  cidadeLabel?: string | null;
  bairroLabel?: string | null;
};


// Derivado da FONTE ÚNICA: rótulo/ícone de cada categoria da diarista.
const DIARISTA_CATEGORY_META = Object.fromEntries(
  CATEGORIAS_DIARISTA.map((c) => [c.key, { label: c.label, icon: c.icon }]),
) as Record<Exclude<CategoriaKey, "montador">, { label: string; icon: AppIconName }>;

// Logos dedicados (assets) por categoria — específicos desta tela.
const CATEGORIA_LOGOS: Partial<
  Record<CategoriaKey, { source: ImageSourcePropType; style: CategoriaCardItem["imageStyle"] }>
> = {
  baba: {
    source: require("../../../assets/images/empregador_buscar/buscar_card_baba_logo.png"),
    style: { width: 115, height: 78, right: -25, bottom: -2 },
  },
  cozinheira: {
    source: require("../../../assets/images/empregador_buscar/buscar_card_cozinheira_logo.png"),
    style: { width: 78, height: 78, right: -5, bottom: -2 },
  },
  diarista: {
    source: require("../../../assets/images/empregador_buscar/buscar_card_diarista_logo.png"),
    style: { width: 100, height: 90, right: -22, bottom: -10 },
  },
  montador: {
    source: require("../../../assets/images/empregador_buscar/buscar_card_montador_logo.png"),
    style: { width: 105, height: 75, right: -20, bottom: -2 },
  },
  // Logos retrato (≈392×638): mantêm a proporção para ancorar no canto inferior.
  faxineira: {
    source: require("../../../assets/images/empregador_buscar/buscar_card_faxineira_logo.png"),
    style: { width: 65, height: 80, right: -6, bottom: -9 },
  },
  passadeira: {
    source: require("../../../assets/images/empregador_buscar/buscar_card_passadeira_logo.png"),
    style: { width: 64, height: 80, right: -4, bottom: -2 },
  },
  // Logos quadrados (500×500).
  cuidadora: {
    source: require("../../../assets/images/empregador_buscar/buscar_card_cuidadora_logo.png"),
    style: { width: 80, height: 80, right: -6, bottom: -2 },
  },
  lavadeira: {
    source: require("../../../assets/images/empregador_buscar/buscar_card_lavadeira_logo.png"),
    style: { width: 80, height: 80, right: -6, bottom: -2 },
  },
};

// Cards de categoria derivados da FONTE ÚNICA + logo opcional por categoria.
const CATEGORIAS: CategoriaCardItem[] = CATEGORIAS_FONTE.map((c) => ({
  key: c.key,
  icon: c.icon,
  title: c.label,
  subtitle: c.subtitle,
  bg: c.bg,
  iconColor: c.fg,
  imageSource: CATEGORIA_LOGOS[c.key]?.source,
  imageStyle: CATEGORIA_LOGOS[c.key]?.style,
}));

function mapApiToProf(d: ApiDiarista, bairro: string, cidade: string, categoria: Exclude<CategoriaKey, "montador"> = "diarista"): Profissional {
  const meta = DIARISTA_CATEGORY_META[categoria];
  const cat = CATEGORIA_BY_KEY[categoria];
  return {
    id: d.userId,
    userId: d.userId,
    tipo: "DIARISTA",
    nome: d.user?.nome ?? "Profissional",
    categoria: meta.label,
    categoriaIcon: meta.icon,
    categoriaKey: categoria,
    localizacao: bairro && cidade ? `${bairro}, ${cidade}` : cidade || "--",
    // O avatar pode estar no perfil (fotoUrl) OU no User (avatarUrl, onde o upload
    // de /api/me/avatar grava). Sem o fallback, a foto da diarista não aparecia.
    avatarUrl: d.fotoUrl ?? d.user?.avatarUrl ?? null,
    // Card único:
    categoriaColor: cat?.fg,
    categoriaBg: cat?.bg,
    valorLabel: formatValorDiarista(d.precoLeve),
    notaNum: d.notaMedia,
    cidadeLabel: cidade || null,
    bairroLabel: bairro || null,
  };
}

function mapMontadorToProf(m: MontadorItem): Profissional {
  const cidadeEstado = [m.cidade, m.estado].filter(Boolean).join(", ");
  return {
    id: m.id,
    userId: m.userId ?? m.user.id,
    tipo: "MONTADOR",
    nome: m.user.nome ?? "Montador",
    categoria: "Montador",
    categoriaIcon: "Wrench",
    categoriaKey: "montador",
    localizacao: cidadeEstado || "Localização a confirmar",
    avatarUrl: m.fotoPerfil ?? m.user.avatarUrl,
    especialidades: m.especialidades,
    cidade: m.cidade,
    estado: m.estado,
    rating: m.rating,
    // Card único:
    categoriaColor: CATEGORIA_BY_KEY.montador.fg,
    categoriaBg: CATEGORIA_BY_KEY.montador.bg,
    valorLabel: formatValorMontador(m),
    notaNum: m.rating,
    cidadeLabel: m.cidade ?? null,
    bairroLabel: m.bairros?.[0] ?? null,
  };
}

function CategoryCard({
  item,
  selected,
  onPress,
}: {
  item: CategoriaCardItem;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.catCard,
        { backgroundColor: item.bg },
        selected && s.catCardSelected,
        pressed && { opacity: 0.88 },
      ]}
    >
      <AppIcon name={item.icon} size={20} color={item.iconColor} strokeWidth={2} />
      <Text style={s.catTitle}>{item.title}</Text>
      <Text style={s.catSubtitle}>{item.subtitle}</Text>
      {item.imageSource ? (
        <Image source={item.imageSource} resizeMode="contain" style={[s.catImage, item.imageStyle]} />
      ) : null}
    </Pressable>
  );
}

// Mapeia o item da busca para os dados do card ÚNICO. SEM layout próprio — toda
// a estrutura visual vive em components/ui/ProfissionalCard.
function profToCardData(prof: Profissional): ProfissionalCardData {
  return {
    id: prof.id,
    userId: prof.userId,
    tipo: prof.tipo,
    nome: prof.nome,
    categoria: prof.categoria,
    categoriaIcon: prof.categoriaIcon,
    categoriaColor: prof.categoriaColor,
    categoriaBg: prof.categoriaBg,
    avatarUrl: prof.avatarUrl,
    cidade: prof.cidadeLabel,
    bairro: prof.bairroLabel,
    valorLabel: prof.valorLabel,
    nota: prof.notaNum,
  };
}

export function BuscarScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<BuscarRoute>();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCat, setSelectedCat] = useState<CategoriaKey | null>(route.params?.categoriaInicial ?? null);
  const authUser = useAuth((state) => state.user);
  const setUser = useAuth((state) => state.setUser);
  const currentRegion = useCurrentRegion();
  const [region, setRegion] = useState<CurrentRegion>({ cidade: "", uf: "", bairro: "" });
  const [regionConfirmed, setRegionConfirmed] = useState(false);
  const [savingRegion, setSavingRegion] = useState(false);
  const [regionError, setRegionError] = useState<string | null>(null);
  // Semeia a região a partir do perfil salvo apenas UMA vez. Sem esse guard, o
  // effect re-dispararia ao detectar GPS/edição manual (que zeram regionConfirmed)
  // e sobrescreveria a localização recém-detectada de volta para a do perfil.
  const profileSeededRef = useRef(false);
  const {
    profissionais: apiProfs,
    montadores: apiMontadores,
    loading,
    error,
    diaristasError,
    montadoresError,
    buscar,
  } = useBuscar();
  const { isFavorito, toggle: toggleFavorito } = useFavoritos();

  const handleToggleFavorito = useCallback(
    async (prof: Profissional) => {
      try {
        await toggleFavorito(prof.userId, prof.tipo);
      } catch {
        Alert.alert(
          "Não foi possível atualizar",
          "Tente novamente em instantes. Verifique sua conexão.",
        );
      }
    },
    [toggleFavorito],
  );

  const handleOpenProfile = useCallback(
    (prof: Profissional) => {
      if (prof.tipo === "MONTADOR") {
        navigation.navigate("MontadorPublicProfile", {
          montadorId: prof.id,
          montadorUserId: prof.userId,
          nome: prof.nome,
          rating: prof.rating,
          especialidades: prof.especialidades,
          cidade: prof.cidade,
          estado: prof.estado,
          avatarUrl: prof.avatarUrl,
        });
        return;
      }
      navigation.navigate("DiaristaProfile", {
        diaristaId: prof.userId,
        nome: prof.nome,
        categoriaInicial: prof.categoriaKey === "montador" ? "diarista" : prof.categoriaKey,
      });
    },
    [navigation],
  );

  useEffect(() => {
    // Fonte de verdade inicial: localização salva no perfil (source: "profile").
    // GPS confirmado / manual confirmado têm prioridade e, uma vez aplicados,
    // não são sobrescritos por este seed (guard via profileSeededRef).
    if (profileSeededRef.current) return;
    const savedCidade = authUser?.cidadeAtual ?? authUser?.cidade ?? "";
    const savedUf = authUser?.estadoAtual ?? authUser?.estado ?? "";
    const savedBairro = authUser?.bairroAtual ?? "";
    if (savedCidade && savedUf) {
      profileSeededRef.current = true;
      setRegion({ cidade: savedCidade, uf: savedUf, bairro: savedBairro });
      setRegionConfirmed(true);
    }
  }, [authUser?.bairroAtual, authUser?.cidade, authUser?.cidadeAtual, authUser?.estado, authUser?.estadoAtual]);

  useEffect(() => {
    if (regionConfirmed && region.cidade && region.uf) {
      buscar({ cidade: region.cidade, uf: region.uf, bairro: region.bairro, categoria: selectedCat ?? undefined });
    }
  }, [buscar, region.bairro, region.cidade, region.uf, regionConfirmed, selectedCat]);

  useEffect(() => {
    if (route.params?.categoriaInicial) {
      setSelectedCat(route.params.categoriaInicial);
    }
  }, [route.params?.categoriaInicial]);

  const handleCatPress = useCallback((key: CategoriaKey) => {
    setSelectedCat((prev) => (prev === key ? null : key));
  }, []);

  const requestRegion = async () => {
    return currentRegion.requestRegion();
  };

  const handleDetectedRegion = (detected: CurrentRegion) => {
    setRegion(detected);
    setRegionConfirmed(false);
    setRegionError(null);
  };

  const confirmRegion = async (nextRegion = region) => {
    if (!nextRegion.cidade.trim() || nextRegion.uf.trim().length !== 2) {
      setRegionError("Informe cidade e UF para buscar profissionais.");
      return;
    }

    try {
      setSavingRegion(true);
      setRegionError(null);
      await salvarLocalizacaoAtual({
        latitude: nextRegion.latitude ?? null,
        longitude: nextRegion.longitude ?? null,
        cidade: nextRegion.cidade.trim(),
        estado: nextRegion.uf.trim().toUpperCase(),
        bairro: nextRegion.bairro.trim() || null,
        localizacaoPermitida: currentRegion.permissionStatus === "granted",
      });
      setUser((prev) => prev ? {
        ...prev,
        cidadeAtual: nextRegion.cidade.trim(),
        estadoAtual: nextRegion.uf.trim().toUpperCase(),
        bairroAtual: nextRegion.bairro.trim() || null,
        localizacaoPermitida: currentRegion.permissionStatus === "granted",
        localizacaoAtualizadaEm: new Date().toISOString(),
      } : prev);
      setRegion(nextRegion);
      setRegionConfirmed(true);
    } catch (err) {
      setRegionError(err instanceof Error ? err.message : "Não foi possível salvar a região.");
    } finally {
      setSavingRegion(false);
    }
  };

  const baseList: Profissional[] = useMemo(
    () =>
      regionConfirmed && (apiProfs.length > 0 || apiMontadores.length > 0)
        ? [
            ...apiProfs.map((d) => mapApiToProf(
              d,
              region.bairro,
              region.cidade,
              selectedCat && selectedCat !== "montador" ? selectedCat : "diarista",
            )),
            ...apiMontadores.map(mapMontadorToProf),
          ]
        : [],
    [apiMontadores, apiProfs, region.bairro, region.cidade, regionConfirmed, selectedCat],
  );

  const filteredList = useMemo(() => {
    let list = baseList;
    if (selectedCat) {
      list = list.filter((p) => p.categoriaKey === selectedCat);
    }
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.nome.toLowerCase().includes(q) ||
          p.localizacao.toLowerCase().includes(q) ||
          p.categoria.toLowerCase().includes(q),
      );
    }
    return list;
  }, [baseList, selectedCat, searchQuery]);

  const categoryError = selectedCat === "montador"
    ? montadoresError
    : selectedCat
      ? diaristasError
      : error;

  const emptyText = selectedCat === "montador"
    ? "Nenhum montador disponível nesta região ainda."
    : !regionConfirmed
      ? "Informe sua região para encontrar profissionais disponíveis."
      : searchQuery || selectedCat
      ? "Nenhum resultado encontrado"
      : "Nenhum profissional disponível";

  const regionText = region.bairro
    ? `${region.bairro}, ${region.cidade} - ${region.uf}`
    : [region.cidade, region.uf].filter(Boolean).join(" - ");

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.root}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.header}>
            <View style={s.headerText}>
              <Text style={s.title}>Buscar</Text>
              <Text style={s.subtitle}>Encontre o profissional ideal{"\n"}para o que você precisa.</Text>
            </View>
          </View>

          <View style={s.searchRow}>
            <View style={s.searchBox}>
              <AppIcon name="Search" size={19} color={colors.textMuted} strokeWidth={2} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Buscar por nome ou bairro..."
                placeholderTextColor="#8C84AA"
                style={s.searchInput}
                returnKeyType="search"
              />
            </View>
          </View>

          <View style={s.regionCardWrap}>
            <View style={s.regionCardInner}>
              <LocationPermissionCard
                title="Região da busca"
                subtitle="Use sua localização ou informe uma região para encontrar profissionais disponíveis."
                region={region}
                permissionStatus={currentRegion.permissionStatus}
                loading={currentRegion.loading}
                saving={savingRegion}
                error={regionError ?? currentRegion.error}
                confirmed={regionConfirmed}
                confirmLabel="Usar esta região"
                onRegionChange={(next) => {
                  setRegion(next);
                  setRegionConfirmed(false);
                }}
                onRequestLocation={requestRegion}
                onDetected={handleDetectedRegion}
                onManual={() => setRegionConfirmed(false)}
                onConfirm={confirmRegion}
              />
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>Escolha uma categoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catScroll}>
              {CATEGORIAS.map((item) => (
                <CategoryCard
                  key={item.key}
                  item={item}
                  selected={selectedCat === item.key}
                  onPress={() => handleCatPress(item.key)}
                />
              ))}
            </ScrollView>
          </View>

          <View style={s.section}>
            <View style={s.sectionHeaderRow}>
              <Text style={s.sectionTitle}>Profissionais em destaque</Text>
              <Pressable
                onPress={() => navigation.navigate("ProfissionaisDestaque")}
                style={({ pressed }) => [s.verTodasBtn, pressed && { opacity: 0.75 }]}
              >
                <Text style={s.verTodasText}>Ver todas</Text>
                <AppIcon name="ChevronRight" size={17} color={colors.primary} strokeWidth={2.3} />
              </Pressable>
            </View>

            {loading ? (
              <DSkeletonCard count={3} height={88} />
            ) : categoryError ? (
              <View style={s.feedbackWrap}>
                <Text style={s.feedbackText}>{categoryError}</Text>
                <DButton
                  variant="secondary"
                  size="sm"
                  label="Tentar novamente"
                  onPress={() => {
                    if (region.cidade && region.uf) {
                      buscar({ cidade: region.cidade, uf: region.uf, bairro: region.bairro, categoria: selectedCat ?? undefined });
                    }
                  }}
                />
              </View>
            ) : filteredList.length === 0 ? (
              <View style={s.feedbackWrap}>
                <AppIcon name="Search" size={32} color={colors.textMuted} strokeWidth={1.6} />
                <Text style={s.feedbackText}>{emptyText}</Text>
                {selectedCat === "montador" && regionText ? (
                  <Text style={s.feedbackHint}>Busca por {regionText}</Text>
                ) : null}
              </View>
            ) : (
              <FlatList
                data={filteredList}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <ProfissionalCard
                    data={profToCardData(item)}
                    favorito={isFavorito(item.userId, item.tipo)}
                    onToggleFavorito={() => handleToggleFavorito(item)}
                    onPress={() => handleOpenProfile(item)}
                  />
                )}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              />
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

export default BuscarScreen;

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  root: {
    flex: 1,
  },
  scroll: {
    paddingBottom: 118,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 10,
  },
  headerText: {
    flex: 1,
    paddingRight: spacing.md,
  },
  title: {
    ...typography.h1,
    fontWeight: "700",
    color: colors.textPrimary,
    letterSpacing: 0,
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.textSecondary,
    fontWeight: "500",
    marginTop: 6,
  },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: spacing.screenPadding,
  },
  searchBox: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lavenderDivider,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
    ...shadows.soft,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    ...typography.bodySmMedium,
    fontWeight: "500",
    paddingVertical: 8,
  },
  regionCardWrap: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: spacing.screenPadding,
  },
  regionCardInner: {
    width: "100%",
  },
  section: {
    paddingHorizontal: spacing.screenPadding,
    gap: 10,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    fontWeight: "700",
    color: colors.textPrimary,
    letterSpacing: 0,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  verTodasBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  verTodasText: {
    ...typography.bodySm,
    fontWeight: "600",
    color: colors.primary,
  },
  catScroll: {
    gap: 10,
    paddingRight: spacing.screenPadding,
  },
  catCard: {
    width: 126,
    height: 154,
    borderRadius: 18,
    paddingTop: 14,
    paddingHorizontal: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    ...shadows.soft,
  },
  catCardSelected: {
    borderColor: colors.primary,
  },
  catTitle: {
    color: colors.textPrimary,
    ...typography.bodySm,
    fontWeight: "700",
    marginTop: 8,
    zIndex: 2,
  },
  catSubtitle: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: "500",
    marginTop: 4,
    zIndex: 2,
    maxWidth: 76,
  },
  catImage: {
    position: "absolute",
    borderRadius: 0,
    zIndex: 1,
  },
  feedbackWrap: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  feedbackText: {
    ...typography.bodySmMedium,
    color: colors.textSecondary,
    textAlign: "center",
  },
  feedbackHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: -8,
  },
});
