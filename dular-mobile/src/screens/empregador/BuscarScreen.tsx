import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppIcon, AppIconName, DAvatar, DBottomNav, DButton, DCard, DInput } from "@/components/ui";
import { colors, radius, shadows, spacing } from "@/theme";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";
import { useBuscar, type ApiDiarista } from "@/hooks/useBuscar";
import { useGeoDefaults } from "@/hooks/useGeoDefaults";
import { useMensagens } from "@/hooks/useMensagens";

type Navigation = BottomTabNavigationProp<EmpregadorTabParamList>;

type CategoriaCardItem = {
  icon: AppIconName;
  title: string;
  subtitle: string;
  bgColor: string;
  tone: "purple" | "pink" | "green" | "yellow";
};

type CategoriaIconeItem = {
  icon: AppIconName;
  label: string;
  tone: "purple" | "pink" | "green" | "blue" | "yellow";
};

type Profissional = {
  id: string;
  name: string;
  category: string;
  categoryIcon: AppIconName;
  location: string;
  rating: string;
  experience: string;
  distance: string;
  online: boolean;
  verified: boolean;
  avatarUrl: string;
};

const CATEGORIAS: CategoriaCardItem[] = [
  {
    icon: "Baby",
    title: "Babá",
    subtitle: "Cuidados com crianças",
    bgColor: colors.primaryLight,
    tone: "purple",
  },
  {
    icon: "ChefHat",
    title: "Cozinheira",
    subtitle: "Preparo de refeições",
    bgColor: colors.warningLight,
    tone: "yellow",
  },
  {
    icon: "Sparkles",
    title: "Diarista",
    subtitle: "Limpeza e organização",
    bgColor: colors.successLight,
    tone: "green",
  },
];

const CATEGORIAS_POPULARES: CategoriaIconeItem[] = [
  { icon: "WashingMachine", label: "Lavadeira", tone: "blue" },
  { icon: "Shirt", label: "Passadeira", tone: "purple" },
  { icon: "Sprout", label: "Jardineiro", tone: "green" },
  { icon: "Car", label: "Motorista", tone: "pink" },
  { icon: "MoreHorizontal", label: "Mais", tone: "yellow" },
];

function mapApiToUI(d: ApiDiarista, bairro: string, cidade: string): Profissional {
  return {
    id: d.userId,
    name: d.user?.nome ?? "Profissional",
    category: "Diarista",
    categoryIcon: "Sparkles",
    location: bairro && cidade ? `${bairro}, ${cidade}` : cidade || "--",
    rating: d.notaMedia > 0 ? d.notaMedia.toFixed(1).replace(".", ",") : "--",
    experience: d.totalServicos > 0 ? `${d.totalServicos} serviços` : "Novo",
    distance: "",
    online: false,
    verified: d.verificacao === "VERIFICADO",
    avatarUrl: d.fotoUrl ?? "",
  };
}

function NotificationButton({
  unreadMessages,
  onPress,
}: {
  unreadMessages: number;
  onPress: () => void;
}) {
  const badgeLabel = unreadMessages > 9 ? "9+" : String(unreadMessages);

  return (
    <Pressable hitSlop={spacing.sm} onPress={onPress}>
      <View style={styles.notificationButton}>
        <AppIcon name="Bell" size={20} color="purple" />
        {unreadMessages > 0 ? (
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationBadgeText}>{badgeLabel}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function CategoriaCard({ item }: { item: CategoriaCardItem }) {
  return (
    <View style={[styles.categoryCard, { backgroundColor: item.bgColor }]}>
      <View style={styles.categoryInfo}>
        <AppIcon name={item.icon} size={22} color={item.tone} variant="soft" />
        <Text style={styles.categoryTitle}>{item.title}</Text>
        <Text style={styles.categorySubtitle}>{item.subtitle}</Text>
      </View>
      <View style={styles.categoryIconArea}>
        <AppIcon name={item.icon} size={42} color={item.tone} variant="filled" />
      </View>
    </View>
  );
}

function CategoriaIcone({ item }: { item: CategoriaIconeItem }) {
  return (
    <View style={styles.popularCategory}>
      <View style={styles.popularIconBox}>
        <AppIcon name={item.icon} size={24} color={item.tone} />
      </View>
      <Text style={styles.popularLabel}>{item.label}</Text>
    </View>
  );
}

function ProfissionalRow({ profissional }: { profissional: Profissional }) {
  const navigation = useNavigation<Navigation>();

  return (
    <DCard style={styles.professionalCard}>
      <View style={styles.professionalRow}>
        <DAvatar
          size="md"
          uri={profissional.avatarUrl}
          initials={profissional.name.slice(0, 2)}
          online={profissional.online}
        />

        <View style={styles.professionalCenter}>
          <View style={styles.nameRow}>
            <Text style={styles.professionalName}>{profissional.name}</Text>
            {profissional.verified ? (
              <View style={styles.verifiedBadge}>
                <AppIcon name="Check" size={10} color={colors.white} strokeWidth={3} />
              </View>
            ) : null}
          </View>

          <View style={styles.categoryBadgeRow}>
            <AppIcon name={profissional.categoryIcon} size={12} color={colors.primary} />
            <View style={styles.professionalCategoryBadge}>
              <Text style={styles.professionalCategoryText}>{profissional.category}</Text>
            </View>
          </View>

          <View style={styles.locationRow}>
            <AppIcon name="MapPin" size={12} color={colors.textSecondary} />
            <Text style={styles.metaText}>{profissional.location}</Text>
          </View>

          <View style={styles.ratingRow}>
            <AppIcon name="Star" size={12} color={colors.pink} strokeWidth={2.4} />
            <Text style={styles.ratingText}>{profissional.rating}</Text>
            <Text style={styles.separator}>•</Text>
            <Text style={styles.metaText}>{profissional.experience}</Text>
          </View>
        </View>

        <View style={styles.professionalRight}>
          <Text style={styles.distance}>{profissional.distance}</Text>
          <DButton
            variant="secondary"
            size="sm"
            label="Ver perfil"
            onPress={() => navigation.navigate("DiaristaProfile", { diaristaId: profissional.id, nome: profissional.name })}
          />
        </View>
      </View>
    </DCard>
  );
}

export function BuscarScreen() {
  const navigation = useNavigation<Navigation>();
  const [searchQuery, setSearchQuery] = useState("");
  const { profissionais: apiProfissionais, loading, error, buscar } = useBuscar();
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

  const handleSearch = useCallback(
    (texto: string) => {
      setSearchQuery(texto);
    },
    []
  );

  const displayProfissionais: Profissional[] =
    apiProfissionais.map((d) => mapApiToUI(d, geo.bairro, geo.cidade));

  const handleBottomNav = (tab: "home" | "search" | "new" | "messages" | "profile") => {
    if (tab === "home") navigation.navigate("Home");
    if (tab === "messages") navigation.navigate("Mensagens");
    if (tab === "profile") navigation.navigate("Perfil");
    if (tab === "new") navigation.navigate("SolicitarServico");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.screenTitle}>Buscar</Text>
              <Text style={styles.screenSubtitle}>
                Encontre o profissional ideal para o que você precisa.
              </Text>
            </View>
            <NotificationButton
              unreadMessages={unreadMessages}
              onPress={() => navigation.navigate("Mensagens")}
            />
          </View>

          <View style={styles.searchRow}>
            <View style={styles.searchInputWrap}>
              <DInput
                placeholder="Buscar por nome ou bairro..."
                icon={<AppIcon name="Search" size={16} color={colors.textDisabled} />}
                value={searchQuery}
                onChangeText={handleSearch}
              />
            </View>
            <Pressable hitSlop={spacing.xs}>
              <View style={styles.filterButton}>
                <AppIcon name="SlidersHorizontal" size={20} color="purple" />
              </View>
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Escolha uma categoria</Text>
            <View style={styles.categoryRow}>
              {CATEGORIAS.map((item) => (
                <CategoriaCard key={item.title} item={item} />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Categorias populares</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.popularRow}>
                {CATEGORIAS_POPULARES.map((item) => (
                  <CategoriaIcone key={item.label} item={item} />
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.professionalsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Profissionais em destaque</Text>
              <Pressable style={styles.sectionLinkButton}>
                <Text style={styles.sectionLink}>Ver todas</Text>
                <AppIcon name="ChevronRight" size={14} color={colors.primary} strokeWidth={2.4} />
              </Pressable>
            </View>

            {loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : error ? (
              <View style={styles.loadingWrap}>
                <Text style={styles.errorText}>Erro ao buscar profissionais</Text>
                <DButton
                  variant="secondary"
                  size="sm"
                  label="Tentar novamente"
                  onPress={() => {
                    if (geo.cidade && geo.uf && geo.bairro) {
                      buscar({ cidade: geo.cidade, uf: geo.uf, bairro: geo.bairro });
                    }
                  }}
                  style={styles.retryButton}
                />
              </View>
            ) : !loading && apiProfissionais.length === 0 && geo.cidade ? (
              <View style={styles.loadingWrap}>
                <AppIcon name="Search" size={36} color={colors.primary} variant="soft" />
                <Text style={styles.errorText}>Nenhum profissional encontrado</Text>
                <DButton
                  variant="secondary"
                  size="sm"
                  label="Atualizar"
                  onPress={() => buscar({ cidade: geo.cidade, uf: geo.uf, bairro: geo.bairro })}
                  style={styles.retryButton}
                />
              </View>
            ) : (
              <FlatList
                data={displayProfissionais}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <ProfissionalRow profissional={item} />}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
              />
            )}
          </View>
        </ScrollView>

        <DBottomNav activeTab="search" messagesBadge={messagesBadge} onPress={handleBottomNav} />
      </View>
    </SafeAreaView>
  );
}

export default BuscarScreen;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  scroll: {
    paddingBottom: spacing["5xl"],
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    marginBottom: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerText: {
    flex: 1,
    paddingRight: spacing.md,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  screenSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    ...shadows.soft,
  },
  notificationBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.white,
  },
  searchRow: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    flexDirection: "row",
    gap: spacing.sm,
  },
  searchInputWrap: {
    flex: 1,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  categoryRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  categoryCard: {
    flex: 1,
    borderRadius: radius.xl,
    overflow: "hidden",
    ...shadows.soft,
  },
  categoryInfo: {
    padding: spacing.md,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  categorySubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  categoryIconArea: {
    height: 80,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: spacing.sm,
  },
  popularRow: {
    flexDirection: "row",
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  popularCategory: {
    alignItems: "center",
    gap: 6,
  },
  popularIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  popularLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: "center",
  },
  professionalsSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionLink: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "600",
  },
  sectionLinkButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  professionalCard: {
    padding: spacing.md,
  },
  professionalRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
  },
  professionalCenter: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  professionalName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryBadgeRow: {
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "center",
    marginTop: 2,
  },
  professionalCategoryBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  professionalCategoryText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "600",
  },
  locationRow: {
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  metaText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  ratingRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  separator: {
    color: colors.textDisabled,
  },
  professionalRight: {
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  distance: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  listSeparator: {
    height: spacing.sm,
  },
  loadingWrap: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  emptyIcon: {
    fontSize: 36,
  },
  errorText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },
  retryButton: {
    marginTop: spacing.xs,
  },
});
