import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import * as Location from "expo-location";

import { api } from "@/lib/api";
import { BuscarDiaristasResponse, DiaristaItem } from "@/types/diarista";
import { ServicoTipo, ServicoCategoria, CriarServicoPayload, CriarServicoResponse } from "@/types/servico";
import { getCatalogoServicos, type CatalogoTipo } from "@/api/catalogoApi";
import { PILOT_MODE, PILOT } from "@/config/pilotConfig";
import { useGeoDefaults } from "@/hooks/useGeoDefaults";
import { useMensagens } from "@/hooks/useMensagens";
import { usePaywallGuard } from "@/hooks/usePaywallGuard";
import { useAuth } from "@/stores/authStore";
import { AppIcon, type AppIconName, DAvatar, DBottomNav, DScreen, DSectionHeader, DSkeletonCard, DEmptyState, DErrorState } from "@/components/ui";
import { colors, gradients, radius, shadows, spacing } from "@/theme";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";

type Navigation = BottomTabNavigationProp<EmpregadorTabParamList>;

// ─── Static category chips ───────────────────────────────────────────────────

type Category = { label: string; icon: AppIconName; tipo: ServicoTipo | null };

const CATEGORIES: Category[] = [
  { label: "Diarista",    icon: "Home",     tipo: "FAXINA"      },
  { label: "Montador",    icon: "Wrench",   tipo: null          },
  { label: "Passadeira",  icon: "Shirt",    tipo: "PASSA_ROUPA" },
  { label: "Jardineiro",  icon: "Sprout",   tipo: null          },
  { label: "Cozinheira",  icon: "ChefHat",  tipo: "COZINHEIRA"  },
  { label: "Babá",        icon: "Baby",     tipo: "BABA"        },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function CategoryChip({
  item,
  active,
  onPress,
}: {
  item: Category;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.75 }]}>
      <View style={[s.chip, active && s.chipActive]}>
        <View style={[s.chipIcon, active && s.chipIconActive]}>
          <AppIcon name={item.icon} size={18} color={active ? colors.white : colors.primary} strokeWidth={2.1} />
        </View>
        <Text style={[s.chipLabel, active && s.chipLabelActive]}>{item.label}</Text>
      </View>
    </Pressable>
  );
}

function ProfessionalCard({
  item,
  loading,
  onPress,
  onSolicitar,
}: {
  item: DiaristaItem;
  loading: boolean;
  onPress: () => void;
  onSolicitar: () => void;
}) {
  const initials = item.user.nome.split(" ").map((w) => w[0]).join("").slice(0, 2);
  const verified = item.verificacao === "VERIFICADO";

  return (
    <View style={s.proCard}>
      <View style={s.proCardInner}>
        <View style={s.proLeft}>
          <DAvatar size="md" initials={initials} online={verified} />
          <View style={s.proInfo}>
            <View style={s.proNameRow}>
              <Text style={s.proName} numberOfLines={1}>{item.user.nome}</Text>
              {verified && (
                <View style={s.verifiedBadge}>
                  <AppIcon name="ShieldCheck" size={12} color={colors.success} strokeWidth={2.5} />
                </View>
              )}
            </View>
            <View style={s.proStarRow}>
              <AppIcon name="Star" size={12} color={colors.warning} strokeWidth={0} />
              <Text style={s.proRating}>{item.notaMedia.toFixed(1)}</Text>
              <Text style={s.proSep}>·</Text>
              <AppIcon name="MapPin" size={11} color={colors.textMuted} strokeWidth={2} />
              <Text style={s.proDistance}>Próxima</Text>
            </View>
            <Text style={s.proPrice}>
              A partir de <Text style={s.proPriceValue}>R$ {item.precoLeve.toFixed(0)}</Text>
            </Text>
          </View>
        </View>

        <View style={s.proActions}>
          <Pressable onPress={onPress} style={s.proViewBtn}>
            <Text style={s.proViewLabel}>Ver perfil</Text>
          </Pressable>
          <Pressable
            onPress={onSolicitar}
            disabled={loading}
            style={[s.proSolBtn, loading && s.proSolBtnLoading]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <AppIcon name="Plus" size={16} color={colors.white} strokeWidth={2.5} />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function AgendaEmptyCard() {
  return (
    <View style={s.agendaEmpty}>
      <AppIcon name="Calendar" size={28} color={colors.primary} strokeWidth={1.8} />
      <Text style={s.agendaEmptyTitle}>Nenhum agendamento</Text>
      <Text style={s.agendaEmptySub}>Seus próximos serviços aparecerão aqui.</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EmpregadorHome() {
  const navigation = useNavigation<Navigation>();
  const user = useAuth((state) => state.user);
  const geo = useGeoDefaults();
  const { verificar } = usePaywallGuard();
  const { rooms } = useMensagens();

  const firstName = useMemo(() => {
    const nome = (user?.nome || "").trim();
    return nome.split(/\s+/)[0] || "você";
  }, [user?.nome]);

  const [selectedTipo, setSelectedTipo] = useState<ServicoTipo>("FAXINA");
  const [categoria, setCategoria] = useState<ServicoCategoria | null>("FAXINA_LEVE");
  const [catalogo, setCatalogo] = useState<CatalogoTipo[]>([]);
  const [diaristas, setDiaristas] = useState<DiaristaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cidade, setCidade] = useState(PILOT_MODE ? PILOT.cidade : "Cuiaba");
  const [uf, setUf] = useState(PILOT_MODE ? PILOT.uf : "MT");
  const [bairro, setBairro] = useState(PILOT_MODE ? PILOT.bairros[0] : "Centro");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [searchText, setSearchText] = useState("");
  const unreadMessages = useMemo(
    () => rooms.reduce((total, room) => total + Math.max(0, Number(room.naoLidas) || 0), 0),
    [rooms],
  );
  const messagesBadge = unreadMessages > 0 ? unreadMessages : undefined;

  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const initialFetchRef = useRef(false);
  const appliedGeoRef = useRef(false);
  const busyRef = useRef(false);
  const handleBuscarRef = useRef<() => void>(() => {});

  const handleBuscar = useCallback(
    async (isRefresh = false) => {
      if (geo.loading || busyRef.current) return;
      busyRef.current = true;
      try {
        setError(null);
        isRefresh ? setRefreshing(true) : setLoading(true);

        const cidadeParam = (cidade || geo.cidade || "").trim();
        const ufParam = (uf || geo.uf || "").trim();
        if (!cidadeParam || !ufParam) return;

        if (geo.coords && !coordsRef.current) {
          coordsRef.current = { lat: geo.coords.latitude, lng: geo.coords.longitude };
          setCoords(coordsRef.current);
        }

        const bairroQuery = bairro.trim();
        if (bairroQuery.length >= 3 && cidadeParam) {
          try {
            const geoRes = await Location.geocodeAsync(`${bairroQuery}, ${cidadeParam}, ${ufParam}, Brasil`);
            if (geoRes?.[0]?.latitude) {
              coordsRef.current = { lat: geoRes[0].latitude, lng: geoRes[0].longitude };
              setCoords(coordsRef.current);
            }
          } catch {}
        }

        const params: Record<string, unknown> = {
          cidade: cidadeParam,
          uf: ufParam,
          bairro,
          tipo: selectedTipo,
          ...(categoria && { categoria }),
          ...(coordsRef.current && { lat: coordsRef.current.lat, lng: coordsRef.current.lng, precisao: "gps" }),
        };

        const res = await api.get<BuscarDiaristasResponse>("/api/diaristas/buscar", { params });
        setDiaristas(res.data.diaristas || []);
      } catch (e: any) {
        setError(e?.response?.data?.error ?? e?.message ?? "Falha ao buscar");
      } finally {
        isRefresh ? setRefreshing(false) : setLoading(false);
        busyRef.current = false;
      }
    },
    [bairro, categoria, cidade, geo.cidade, geo.coords, geo.loading, geo.uf, selectedTipo, uf],
  );

  async function criarServico(diaristaUserId: string) {
    try {
      setCreatingId(diaristaUserId);
      const payload: CriarServicoPayload = {
        tipo: selectedTipo,
        ...(categoria && { categoria }),
        dataISO: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        turno: "MANHA",
        cidade,
        uf,
        bairro,
        diaristaUserId,
        latitude: coords?.lat,
        longitude: coords?.lng,
        temPet: false,
        observacoes: "Pedido criado pelo app.",
      };
      const res = await api.post<CriarServicoResponse>("/api/servicos", payload);
      Alert.alert("Serviço solicitado!", `ID: ${res.data.servicoId}`);
    } catch (e: any) {
      Alert.alert("Erro", e?.response?.data?.error ?? "Falha ao criar serviço");
    } finally {
      setCreatingId(null);
    }
  }

  const handleCategoryPress = useCallback(
    (cat: Category) => {
      if (!cat.tipo) {
        Alert.alert("Em breve", `${cat.label} ainda não está disponível no app.`);
        return;
      }
      setSelectedTipo(cat.tipo);
      const match = catalogo.find((e) => e.tipo === cat.tipo);
      setCategoria((match?.categorias?.[0]?.categoria as ServicoCategoria) ?? null);
    },
    [catalogo],
  );

  const handleNav = useCallback(
    (tab: "home" | "search" | "new" | "messages" | "profile") => {
      if (tab === "search") navigation.navigate("Buscar");
      else if (tab === "new") navigation.navigate("SolicitarServico");
      else if (tab === "messages") navigation.navigate("Mensagens");
      else if (tab === "profile") navigation.navigate("Perfil");
    },
    [navigation],
  );

  useEffect(() => {
    let mounted = true;
    getCatalogoServicos()
      .then((res) => {
        if (!mounted) return;
        setCatalogo(res?.tipos ?? []);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    handleBuscarRef.current = () => handleBuscar();
  }, [handleBuscar]);

  useEffect(() => {
    if (geo.loading || !geo.coords || appliedGeoRef.current) return;
    appliedGeoRef.current = true;
    const c = { lat: geo.coords.latitude, lng: geo.coords.longitude };
    coordsRef.current = c;
    setCoords(c);
    if (geo.cidade) setCidade(geo.cidade);
    if (geo.uf) setUf(geo.uf);
    if (geo.bairro) setBairro(geo.bairro);
  }, [geo.bairro, geo.cidade, geo.coords, geo.loading, geo.uf]);

  useEffect(() => {
    if (geo.loading || initialFetchRef.current) return;
    initialFetchRef.current = true;
    handleBuscarRef.current();
  }, [geo.loading]);

  return (
    <DScreen backgroundColor={colors.background}>
      <View style={s.root}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => handleBuscar(true)} tintColor={colors.primary} />}
        >
          {/* ── Header + Search + Categories (tight grouping) ── */}
          <View style={s.topSection}>
            <View style={s.header}>
              <View>
                <Text style={s.greetingSub}>Bem-vindo de volta</Text>
                <Text style={s.greeting}>
                  Olá, {firstName} <Text style={s.wave}>👋</Text>
                </Text>
              </View>
              <View style={s.headerRight}>
                <Pressable
                  hitSlop={8}
                  style={s.notifBtn}
                  onPress={() => navigation.navigate("Mensagens")}
                >
                  <AppIcon name="Bell" size={20} color={colors.primary} strokeWidth={2} />
                  {unreadMessages > 0 ? (
                    <View style={s.notificationBadge}>
                      <Text style={s.notificationBadgeText}>{unreadMessages > 9 ? "9+" : unreadMessages}</Text>
                    </View>
                  ) : null}
                </Pressable>
                <DAvatar size="sm" initials={firstName.slice(0, 2)} />
              </View>
            </View>

            <View style={s.searchWrap}>
              <AppIcon name="Search" size={17} color={colors.textMuted} strokeWidth={2.1} />
              <TextInput
                style={s.searchInput}
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Qual serviço você precisa?"
                placeholderTextColor={colors.textMuted}
                returnKeyType="search"
                onSubmitEditing={() => handleBuscar()}
              />
              {searchText.length > 0 && (
                <Pressable hitSlop={8} onPress={() => setSearchText("")}>
                  <AppIcon name="XCircle" size={16} color={colors.textMuted} strokeWidth={2} />
                </Pressable>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.chipsRow}
            >
              {CATEGORIES.map((cat) => (
                <CategoryChip
                  key={cat.label}
                  item={cat}
                  active={cat.tipo === selectedTipo}
                  onPress={() => handleCategoryPress(cat)}
                />
              ))}
            </ScrollView>
          </View>

          {/* ── Hero card ── */}
          <LinearGradient
            colors={gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.hero}
          >
            <View style={s.heroBlob1} />
            <View style={s.heroBlob2} />
            <View style={s.heroContent}>
              <Text style={s.heroSub}>Sua casa mais limpa e organizada</Text>
              <Text style={s.heroTitle}>Encontre profissionais{"\n"}de confiança</Text>
              <Pressable
                onPress={() => navigation.navigate("Buscar")}
                style={s.heroCta}
              >
                <Text style={s.heroCtaText}>Buscar agora</Text>
                <AppIcon name="ChevronRight" size={16} color={colors.primary} strokeWidth={2.5} />
              </Pressable>
            </View>
            <View style={s.heroIllustration}>
              <AppIcon name="Sparkles" size={44} color={colors.glassLight} strokeWidth={1.5} />
            </View>
          </LinearGradient>

          {/* ── Profissionais em destaque ── */}
          <View style={s.section}>
            <DSectionHeader
              title="Profissionais em destaque"
              action="Ver todos"
              onAction={() => navigation.navigate("Buscar")}
            />

            {loading && !refreshing ? (
              <DSkeletonCard count={3} height={76} />
            ) : error ? (
              <DErrorState
                message={error}
                onRetry={() => handleBuscar()}
              />
            ) : diaristas.length === 0 ? (
              <DEmptyState
                title="Nenhuma diarista encontrada"
                subtitle="Tente outra categoria ou localização."
              />
            ) : (
              diaristas.slice(0, 5).map((item) => (
                <ProfessionalCard
                  key={item.id}
                  item={item}
                  loading={creatingId === item.user.id}
                  onPress={() =>
                    navigation.navigate("DiaristaProfile", {
                      diaristaId: item.user.id,
                      nome: item.user.nome,
                    })
                  }
                  onSolicitar={() =>
                    verificar("servicosMes", () => {
                      void criarServico(item.user.id);
                    })
                  }
                />
              ))
            )}
          </View>

          {/* ── Agenda rápida ── */}
          <View style={s.section}>
            <DSectionHeader
              title="Próximos agendamentos"
              action="Ver agenda"
              onAction={() => navigation.navigate("SolicitarServico")}
            />
            <AgendaEmptyCard />
          </View>
        </ScrollView>

        <DBottomNav activeTab="home" variant="empregador" messagesBadge={messagesBadge} onPress={handleNav} />
      </View>
    </DScreen>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    paddingBottom: 112,
    gap: spacing.sectionGap,
  },

  // Top grouping — tight spacing between greeting / search / categories
  topSection: {
    gap: spacing.md,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.lg,
  },
  greetingSub: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
  greeting: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.textPrimary,
    marginTop: 2,
  },
  wave: {
    fontSize: 22,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    ...shadows.soft,
  },
  notificationBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "700",
  },

  // Search
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.screenPadding,
    height: 50,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadows.soft,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: "500",
  },

  // Categories
  chipsRow: {
    gap: spacing.sm,
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 2,
  },
  chip: {
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    minWidth: 72,
    ...shadows.soft,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.lavender,
    alignItems: "center",
    justifyContent: "center",
  },
  chipIconActive: {
    backgroundColor: colors.whiteAlpha20,
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
    textAlign: "center",
  },
  chipLabelActive: {
    color: colors.white,
  },

  // Hero card
  hero: {
    marginHorizontal: spacing.screenPadding,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    minHeight: 160,
    overflow: "hidden",
    position: "relative",
  },
  heroBlob1: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.whiteAlpha08,
    right: -30,
    top: -30,
  },
  heroBlob2: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.whiteAlpha08,
    right: 60,
    bottom: -20,
  },
  heroContent: {
    flex: 1,
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  heroSub: {
    fontSize: 12,
    color: colors.whiteAlpha70,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.white,
    lineHeight: 28,
  },
  heroCta: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: 4,
    marginTop: spacing.sm,
  },
  heroCtaText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
  heroIllustration: {
    position: "absolute",
    right: spacing.xl,
    top: spacing.xl,
    opacity: 0.35,
  },

  // Section
  section: {
    gap: spacing.md,
    paddingHorizontal: spacing.screenPadding,
  },

  // Professional card
  proCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  proCardInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    gap: spacing.sm,
  },
  proLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  proInfo: {
    flex: 1,
    gap: 3,
  },
  proNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  proName: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.textPrimary,
    flexShrink: 1,
  },
  verifiedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.successSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  proStarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  proRating: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.warning,
  },
  proSep: {
    fontSize: 12,
    color: colors.textMuted,
    marginHorizontal: 2,
  },
  proDistance: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "500",
  },
  proPrice: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  proPriceValue: {
    fontWeight: "800",
    color: colors.primary,
  },
  proActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  proViewBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  proViewLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  proSolBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  proSolBtnLoading: {
    opacity: 0.6,
  },

  // Quick agenda
  agendaEmpty: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    ...shadows.soft,
  },
  agendaEmptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  agendaEmptySub: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
