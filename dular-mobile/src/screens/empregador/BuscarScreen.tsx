import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import {
  AppIcon,
  type AppIconName,
  DAvatar,
  DButton,
  DSkeletonCard,
} from "@/components/ui";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";
import { useBuscar, type ApiDiarista } from "@/hooks/useBuscar";
import { MONTADOR_ESPECIALIDADES as MONTADOR_ESPECIALIDADES_PUBLICAS, type MontadorItem } from "@/types/montador";
import { useGeoDefaults } from "@/hooks/useGeoDefaults";
import { useMensagens } from "@/hooks/useMensagens";

type Navigation = BottomTabNavigationProp<EmpregadorTabParamList>;
type BuscarRoute = RouteProp<EmpregadorTabParamList, "Buscar">;

type CategoriaKey = "baba" | "cozinheira" | "diarista" | "montador";

type CategoriaCardItem = {
  key: CategoriaKey;
  icon: AppIconName;
  title: string;
  subtitle: string;
  bg: string;
  iconColor: string;
  imageUrl: string;
  imageStyle?: {
    width: number;
    height: number;
    right?: number;
    left?: number;
    bottom?: number;
  };
};

type CategoriaPopularItem = {
  icon: AppIconName;
  label: string;
  key: string;
};

type Profissional = {
  id: string;
  userId: string;
  tipo: "DIARISTA" | "MONTADOR";
  nome: string;
  categoria: string;
  categoriaIcon: AppIconName;
  categoriaKey: CategoriaKey;
  localizacao: string;
  nota: string;
  experiencia: string;
  distancia: string;
  online: boolean;
  verificado: boolean;
  avatarUrl?: string | null;
  especialidades?: string[];
  cidade?: string | null;
  estado?: string | null;
  rating?: number;
  precoLabel?: string;
};

const MONTADOR_LABELS = Object.fromEntries(
  MONTADOR_ESPECIALIDADES_PUBLICAS.map((item) => [item.id, item.label]),
) as Record<string, string>;

const CATEGORIAS: CategoriaCardItem[] = [
  {
    key: "baba",
    icon: "Baby",
    title: "Babá",
    subtitle: "Cuidados com\ncrianças",
    bg: "#F2ECFF",
    iconColor: colors.primary,
    imageUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=facearea&facepad=3&w=240&h=240&q=80",
    imageStyle: { width: 90, height: 90, left: -2, bottom: -3 },
  },
  {
    key: "cozinheira",
    icon: "ChefHat",
    title: "Cozinheira",
    subtitle: "Preparo de\nrefeições",
    bg: "#FFF0E2",
    iconColor: "#F47A1F",
    imageUrl: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=facearea&facepad=2.5&w=240&h=240&q=80",
    imageStyle: { width: 90, height: 90, right: 2, bottom: -3 },
  },
  {
    key: "diarista",
    icon: "BrushCleaning",
    title: "Diarista",
    subtitle: "Limpeza e\norganização",
    bg: "#E7F7EF",
    iconColor: "#19A86A",
    imageUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&facepad=2.5&w=240&h=240&q=80",
    imageStyle: { width: 90, height: 90, right: 0, bottom: -3 },
  },
  {
    key: "montador",
    icon: "Wrench",
    title: "Montador",
    subtitle: "Montagem e\nreparos",
    bg: colors.tealSoft,
    iconColor: colors.tealDark,
    imageUrl: "https://images.unsplash.com/photo-1505798577917-a65157d3320a?auto=format&fit=facearea&facepad=2.5&w=240&h=240&q=80",
    imageStyle: { width: 92, height: 92, right: -2, bottom: -3 },
  },
];

const CATEGORIAS_POPULARES: CategoriaPopularItem[] = [
  { icon: "Shirt", label: "Lavadeira", key: "lavadeira" },
  { icon: "BriefcaseBusiness", label: "Passadeira", key: "passadeira" },
  { icon: "Sprout", label: "Jardineiro", key: "jardineiro" },
  { icon: "Car", label: "Motorista", key: "motorista" },
  { icon: "Grid2x2", label: "Mais", key: "mais" },
];

const MOCK_PROFISSIONAIS: Profissional[] = [
  {
    id: "mock-1",
    userId: "mock-1",
    tipo: "DIARISTA",
    nome: "Luciana Silva",
    categoria: "Diarista",
    categoriaIcon: "BrushCleaning",
    categoriaKey: "diarista",
    localizacao: "Jardim América, SP",
    nota: "4,9",
    experiencia: "5 anos exp.",
    distancia: "1,2 km",
    online: true,
    verificado: true,
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&facepad=2&w=180&h=180&q=80",
  },
  {
    id: "mock-2",
    userId: "mock-2",
    tipo: "DIARISTA",
    nome: "Juliana Castro",
    categoria: "Babá",
    categoriaIcon: "Baby",
    categoriaKey: "baba",
    localizacao: "Vila Mariana, SP",
    nota: "4,8",
    experiencia: "3 anos exp.",
    distancia: "2,4 km",
    online: true,
    verificado: true,
    avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=facearea&facepad=2&w=180&h=180&q=80",
  },
  {
    id: "mock-3",
    userId: "mock-3",
    tipo: "DIARISTA",
    nome: "Renata Lima",
    categoria: "Cozinheira",
    categoriaIcon: "ChefHat",
    categoriaKey: "cozinheira",
    localizacao: "Moema, SP",
    nota: "4,9",
    experiencia: "7 anos exp.",
    distancia: "3,1 km",
    online: true,
    verificado: true,
    avatarUrl: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=facearea&facepad=2&w=180&h=180&q=80",
  },
  {
    id: "mock-4",
    userId: "mock-4",
    tipo: "DIARISTA",
    nome: "Carla Souza",
    categoria: "Diarista",
    categoriaIcon: "BrushCleaning",
    categoriaKey: "diarista",
    localizacao: "Perdizes, SP",
    nota: "4,7",
    experiencia: "4 anos exp.",
    distancia: "3,8 km",
    online: true,
    verificado: true,
    avatarUrl: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=facearea&facepad=2&w=180&h=180&q=80",
  },
  {
    id: "mock-5",
    userId: "mock-5",
    tipo: "DIARISTA",
    nome: "Aline Ferreira",
    categoria: "Babá",
    categoriaIcon: "Baby",
    categoriaKey: "baba",
    localizacao: "Itaim Bibi, SP",
    nota: "4,8",
    experiencia: "2 anos exp.",
    distancia: "4,5 km",
    online: true,
    verificado: true,
    avatarUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=facearea&facepad=2&w=180&h=180&q=80",
  },
];

function mapApiToProf(d: ApiDiarista, bairro: string, cidade: string): Profissional {
  return {
    id: d.userId,
    userId: d.userId,
    tipo: "DIARISTA",
    nome: d.user?.nome ?? "Profissional",
    categoria: "Diarista",
    categoriaIcon: "BrushCleaning",
    categoriaKey: "diarista",
    localizacao: bairro && cidade ? `${bairro}, ${cidade}` : cidade || "--",
    nota: d.notaMedia > 0 ? d.notaMedia.toFixed(1).replace(".", ",") : "--",
    experiencia: d.totalServicos > 0 ? `${d.totalServicos} serviços` : "Novo",
    distancia: "",
    online: false,
    verificado: d.verificacao === "VERIFICADO",
    avatarUrl: d.fotoUrl,
  };
}

function mapMontadorToProf(m: MontadorItem): Profissional {
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
    categoria: "Montador",
    categoriaIcon: "Wrench",
    categoriaKey: "montador",
    localizacao: cidadeEstado || "Localização a confirmar",
    nota: m.rating > 0 ? m.rating.toFixed(1).replace(".", ",") : "--",
    experiencia: principais || (m.totalServicos > 0 ? `${m.totalServicos} serviços` : "Perfil profissional completo"),
    distancia: m.precoLabel ?? (m.valorACombinar ? "A combinar" : ""),
    online: false,
    verificado: m.verificado,
    avatarUrl: m.fotoPerfil ?? m.user.avatarUrl,
    especialidades: m.especialidades,
    cidade: m.cidade,
    estado: m.estado,
    rating: m.rating,
    precoLabel: m.precoLabel,
  };
}

function NotifButton({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <Pressable
      hitSlop={spacing.sm}
      onPress={onPress}
      style={({ pressed }) => [s.notifBtn, pressed && { opacity: 0.75 }]}
    >
      <AppIcon name="Bell" size={19} color={colors.primary} strokeWidth={2} />
      {count > 0 ? <View style={s.notifDot} /> : null}
    </Pressable>
  );
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
      <Image source={{ uri: item.imageUrl }} resizeMode="cover" style={[s.catImage, item.imageStyle]} />
    </Pressable>
  );
}

function PopularItem({ item }: { item: CategoriaPopularItem }) {
  return (
    <Pressable style={({ pressed }) => [s.popItem, pressed && { opacity: 0.76 }]}>
      <View style={s.popIconCircle}>
        <AppIcon name={item.icon} size={20} color={colors.primary} strokeWidth={2} />
      </View>
      <Text style={s.popLabel}>{item.label}</Text>
    </Pressable>
  );
}

function ProfileButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.profileButton, pressed && { opacity: 0.8 }]}>
      <Text style={s.profileButtonText}>Ver perfil</Text>
    </Pressable>
  );
}

function ProfCard({ prof }: { prof: Profissional }) {
  const navigation = useNavigation<Navigation>();
  const initials = prof.nome.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <View style={s.profCard}>
      <View style={s.avatarWrap}>
        <DAvatar size="md" uri={prof.avatarUrl ?? undefined} initials={initials} />
        {prof.online ? <View style={s.onlineDot} /> : null}
      </View>

      <View style={s.profCenter}>
        <View style={s.profNameRow}>
          <Text style={s.profName} numberOfLines={1}>{prof.nome}</Text>
          {prof.verificado ? <AppIcon name="Diamond" size={13} color={colors.success} strokeWidth={2.4} /> : null}
        </View>

        <View style={s.catBadge}>
          <AppIcon name={prof.categoriaIcon} size={9} color={colors.primary} strokeWidth={2} />
          <Text style={s.catBadgeText}>{prof.categoria}</Text>
        </View>

        <Text style={s.locationText} numberOfLines={1}>{prof.localizacao}</Text>

        <View style={s.ratingRow}>
          <AppIcon name="Star" size={12} color={colors.warning} strokeWidth={2.3} />
          <Text style={s.ratingText}>{prof.nota}</Text>
          <Text style={s.metaSep}>•</Text>
          <Text style={s.metaText}>{prof.experiencia}</Text>
        </View>
      </View>

      <View style={s.profRight}>
        {prof.distancia ? <Text style={s.distText}>{prof.distancia}</Text> : null}
        <ProfileButton
          onPress={() => {
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
            });
          }}
        />
      </View>
    </View>
  );
}

export function BuscarScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<BuscarRoute>();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCat, setSelectedCat] = useState<CategoriaKey | null>(route.params?.categoriaInicial ?? null);
  const { profissionais: apiProfs, montadores: apiMontadores, loading, error, buscar } = useBuscar();
  const geo = useGeoDefaults();
  const { rooms } = useMensagens();

  const unreadMessages = useMemo(
    () => rooms.reduce((total, room) => total + Math.max(0, Number(room.naoLidas) || 0), 0),
    [rooms],
  );
  const messagesBadge = unreadMessages > 0 ? unreadMessages : undefined;

  useEffect(() => {
    if (geo.cidade && geo.uf && geo.bairro) {
      buscar({ cidade: geo.cidade, uf: geo.uf, bairro: geo.bairro });
    }
  }, [geo.cidade, geo.uf, geo.bairro, buscar]);

  useEffect(() => {
    if (route.params?.categoriaInicial) {
      setSelectedCat(route.params.categoriaInicial);
    }
  }, [route.params?.categoriaInicial]);

  const handleCatPress = useCallback((key: CategoriaKey) => {
    setSelectedCat((prev) => (prev === key ? null : key));
  }, []);

  const baseList: Profissional[] = useMemo(
    () =>
      apiProfs.length > 0 || apiMontadores.length > 0
        ? [
            ...apiProfs.map((d) => mapApiToProf(d, geo.bairro, geo.cidade)),
            ...apiMontadores.map(mapMontadorToProf),
          ]
        : MOCK_PROFISSIONAIS,
    [apiMontadores, apiProfs, geo.bairro, geo.cidade],
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
            <NotifButton count={unreadMessages} onPress={() => navigation.navigate("Notificacoes")} />
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
            <Pressable hitSlop={spacing.xs} style={({ pressed }) => [s.filterBtn, pressed && { opacity: 0.76 }]}>
              <AppIcon name="SlidersHorizontal" size={19} color={colors.primary} strokeWidth={2} />
            </Pressable>
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
            <Text style={s.sectionTitle}>Categorias populares</Text>
            <View style={s.popRow}>
              {CATEGORIAS_POPULARES.map((item) => (
                <PopularItem key={item.key} item={item} />
              ))}
            </View>
          </View>

          <View style={s.section}>
            <View style={s.sectionHeaderRow}>
              <Text style={s.sectionTitle}>Profissionais em destaque</Text>
              <Pressable style={({ pressed }) => [s.verTodasBtn, pressed && { opacity: 0.75 }]}>
                <Text style={s.verTodasText}>Ver todas</Text>
                <AppIcon name="ChevronRight" size={17} color={colors.primary} strokeWidth={2.3} />
              </Pressable>
            </View>

            {loading ? (
              <DSkeletonCard count={3} height={88} />
            ) : error ? (
              <View style={s.feedbackWrap}>
                <Text style={s.feedbackText}>Erro ao buscar profissionais</Text>
                <DButton
                  variant="secondary"
                  size="sm"
                  label="Tentar novamente"
                  onPress={() => {
                    if (geo.cidade && geo.uf && geo.bairro) {
                      buscar({ cidade: geo.cidade, uf: geo.uf, bairro: geo.bairro });
                    }
                  }}
                />
              </View>
            ) : filteredList.length === 0 ? (
              <View style={s.feedbackWrap}>
                <AppIcon name="Search" size={32} color={colors.textMuted} strokeWidth={1.6} />
                <Text style={s.feedbackText}>
                  {searchQuery || selectedCat ? "Nenhum resultado encontrado" : "Nenhum profissional disponível"}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredList}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <ProfCard prof={item} />}
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
    color: colors.primaryDark,
    letterSpacing: 0,
  },
  subtitle: {
    ...typography.bodySm,
    
    color: colors.textSecondary,
    fontWeight: "500",
    marginTop: 6,
  },
  notifBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  notifDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.notification,
    borderWidth: 1.5,
    borderColor: colors.surface,
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
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.lavenderSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.lavenderDivider,
    ...shadows.soft,
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
    width: 104,
    height: 138,
    borderRadius: 16,
    paddingTop: 14,
    paddingHorizontal: 13,
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
  },
  catSubtitle: {
    color: colors.textSecondary,
    ...typography.caption,
    
    fontWeight: "500",
    marginTop: 4,
  },
  catImage: {
    position: "absolute",
    borderRadius: 54,
  },
  popRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  popItem: {
    width: 54,
    alignItems: "center",
    gap: 7,
  },
  popIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.lavender,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  popLabel: {
    color: colors.textSecondary,
    ...typography.caption,
    
    fontWeight: "500",
    textAlign: "center",
  },
  profCard: {
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
    position: "relative",
  },
  onlineDot: {
    position: "absolute",
    top: 1,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  profCenter: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  profNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  profName: {
    flexShrink: 1,
    color: colors.textPrimary,
    ...typography.bodySmMedium,
    
    fontWeight: "700",
  },
  catBadge: {
    alignSelf: "flex-start",
    minHeight: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.lavender,
    paddingHorizontal: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  catBadgeText: {
    color: colors.primary,
    ...typography.caption,
    fontWeight: "700",
  },
  locationText: {
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
  profRight: {
    width: 82,
    alignItems: "flex-end",
    alignSelf: "stretch",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  distText: {
    color: colors.textSecondary,
    ...typography.caption,
    
    fontWeight: "500",
  },
  profileButton: {
    minHeight: 31,
    minWidth: 78,
    borderRadius: 11,
    borderWidth: 1.3,
    borderColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  profileButtonText: {
    color: colors.primary,
    ...typography.caption,
    
    fontWeight: "700",
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
});
