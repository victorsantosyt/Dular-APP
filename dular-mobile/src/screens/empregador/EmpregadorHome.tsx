import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import * as Location from "expo-location";

import { api } from "@/lib/api";
import type { BuscarDiaristasResponse, DiaristaItem } from "@/types/diarista";
import type { ServicoTipo, ServicoCategoria } from "@/types/servico";
import { getCatalogoServicos, type CatalogoTipo } from "@/api/catalogoApi";
import { PILOT_MODE, PILOT } from "@/config/pilotConfig";
import { useGeoDefaults } from "@/hooks/useGeoDefaults";
import { useMensagens } from "@/hooks/useMensagens";
import { usePaywallGuard } from "@/hooks/usePaywallGuard";
import { useAuth } from "@/stores/authStore";
import {
  AppIcon,
  type AppIconName,
  DAvatar,
  DScreen,
  DSectionHeader,
  DSkeletonCard,
  DErrorState,
} from "@/components/ui";
import { colors, gradients, radius, shadows, spacing, typography } from "@/theme";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";

type Navigation = BottomTabNavigationProp<EmpregadorTabParamList>;

// ─── Mock professionals (fallback when API returns empty) ─────────────────────

type ProfData = {
  id: string;
  nome: string;
  anos: number;
  bairro: string;
  disponibilidade: string;
  nota: number;
  preco: number;
  online: boolean;
};

const MOCK_PROFESSIONALS: ProfData[] = [
  {
    id: "mock-1",
    nome: "Luciana Silva",
    anos: 5,
    bairro: "Jardim América, SP",
    disponibilidade: "Disponível hoje",
    nota: 4.9,
    preco: 150,
    online: true,
  },
  {
    id: "mock-2",
    nome: "Marina Santos",
    anos: 3,
    bairro: "Vila Mariana, SP",
    disponibilidade: "Disponível amanhã",
    nota: 4.8,
    preco: 140,
    online: true,
  },
];

function diaristaToProf(item: DiaristaItem): ProfData {
  return {
    id: item.user.id,
    nome: item.user.nome,
    anos: 3,
    bairro: "Próxima de você",
    disponibilidade: "Disponível",
    nota: item.notaMedia,
    preco: item.precoLeve,
    online: item.verificacao === "VERIFICADO",
  };
}

// ─── Quick Action Card ────────────────────────────────────────────────────────

type QuickAction = { icon: AppIconName; label: string; onPress: () => void };

function QuickActionCard({ icon, label, onPress }: QuickAction) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.qaCard, pressed && s.qaCardPressed]}
    >
      <View style={s.qaIconWrap}>
        <AppIcon name={icon} size={24} color={colors.textPrimary} strokeWidth={1.8} />
      </View>
      <Text allowFontScaling={false} style={s.qaLabel}>{label}</Text>
    </Pressable>
  );
}

// ─── Professional Card ────────────────────────────────────────────────────────

function SuggestedProfCard({
  prof,
  onPress,
}: {
  prof: ProfData;
  onPress: () => void;
}) {
  const initials = prof.nome
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={s.profCard}>
      {/* Avatar + online dot + rating pill */}
      <View style={s.profAvatarCol}>
        <View style={s.profAvatarWrap}>
          <DAvatar size="lg" initials={initials} />
          {prof.online && <View style={s.onlineDot} />}
        </View>
        <View style={s.ratingPill}>
          <Text style={s.ratingPillStar}>★</Text>
          <Text allowFontScaling={false} style={s.ratingPillText}>
            {prof.nota.toFixed(1)}
          </Text>
        </View>
      </View>

      {/* Name / experience / location / availability */}
      <View style={s.profInfo}>
        <Text allowFontScaling={false} style={s.profName} numberOfLines={1}>
          {prof.nome}
        </Text>
        <Text allowFontScaling={false} style={s.profYears}>
          {prof.anos} anos de experiência
        </Text>
        <View style={s.profLocRow}>
          <AppIcon name="MapPin" size={11} color={colors.textMuted} strokeWidth={2} />
          <Text allowFontScaling={false} style={s.profLoc} numberOfLines={1}>
            {prof.bairro}
          </Text>
        </View>
        <View style={s.availPill}>
          <Text allowFontScaling={false} style={s.availText}>
            {prof.disponibilidade}
          </Text>
        </View>
      </View>

      {/* Price + Ver perfil button */}
      <View style={s.profPriceCol}>
        <View style={s.profPriceGroup}>
          <Text allowFontScaling={false} style={s.profPriceLabel}>A partir de</Text>
          <Text allowFontScaling={false} style={s.profPrice}>R$ {prof.preco}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [s.profViewBtn, pressed && { opacity: 0.75 }]}
          onPress={onPress}
        >
          <Text allowFontScaling={false} style={s.profViewText}>Ver perfil</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Categoria Card (grid "Quem você precisa hoje?") ─────────────────────────

function CategoriaCard({
  icon,
  title,
  onPress,
  disabled,
}: {
  icon: AppIconName;
  title: string;
  onPress?: () => void;
  /** Mostra a tag "Em breve" e desabilita o toque. */
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.catCard,
        disabled && s.catCardDisabled,
        !disabled && pressed && { opacity: 0.85 },
      ]}
    >
      <View style={[s.catIconWrap, disabled && s.catIconWrapDisabled]}>
        <AppIcon
          name={icon}
          size={24}
          color={disabled ? colors.textMuted : colors.primary}
          strokeWidth={2.1}
        />
      </View>
      <Text style={[s.catTitle, disabled && s.catTitleDisabled]} numberOfLines={1}>
        {title}
      </Text>
      {disabled ? (
        <View style={s.catBadge}>
          <Text style={s.catBadgeText}>Em breve</Text>
        </View>
      ) : null}
    </Pressable>
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cidade, setCidade] = useState(PILOT_MODE ? PILOT.cidade : "Cuiaba");
  const [uf, setUf] = useState(PILOT_MODE ? PILOT.uf : "MT");
  const [bairro, setBairro] = useState(PILOT_MODE ? PILOT.bairros[0] : "Centro");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

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
          ...(coordsRef.current && {
            lat: coordsRef.current.lat,
            lng: coordsRef.current.lng,
            precisao: "gps",
          }),
        };

        const res = await api.get<BuscarDiaristasResponse>("/api/diaristas/buscar", { params });
        setDiaristas(res.data.diaristas || []);
      } catch (e: unknown) {
        const err = e as { response?: { data?: { error?: string } }; message?: string };
        setError(err?.response?.data?.error ?? err?.message ?? "Falha ao buscar");
      } finally {
        isRefresh ? setRefreshing(false) : setLoading(false);
        busyRef.current = false;
      }
    },
    [bairro, categoria, cidade, geo.cidade, geo.coords, geo.loading, geo.uf, selectedTipo, uf],
  );

  useEffect(() => {
    let mounted = true;
    getCatalogoServicos()
      .then((res) => { if (mounted) setCatalogo(res?.tipos ?? []); })
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

  const profissionals: ProfData[] = useMemo(() => {
    if (diaristas.length > 0) return diaristas.slice(0, 5).map(diaristaToProf);
    return MOCK_PROFESSIONALS;
  }, [diaristas]);

  const quickActions: QuickAction[] = [
    { icon: "FileText",      label: "Solicitações",  onPress: () => navigation.navigate("Agendamentos") },
    { icon: "Star",          label: "Favoritas",     onPress: () => navigation.navigate("Buscar") },
    { icon: "Clock",         label: "Histórico",     onPress: () => navigation.navigate("Agendamentos") },
    { icon: "MessageCircle", label: "Mensagens",     onPress: () => navigation.navigate("Mensagens") },
  ];

  return (
    <DScreen backgroundColor={colors.background}>
      <View style={s.root}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => handleBuscar(true)}
              tintColor={colors.primary}
            />
          }
        >
          {/* ── Header: greeting centered, bell absolutely right ── */}
          <View style={s.header}>
            <View style={s.headerCenter}>
              <Text allowFontScaling={false} style={s.greeting}>
                Olá, {firstName}! 👋
              </Text>
              <Text allowFontScaling={false} style={s.greetingSub}>
                O que vamos cuidar hoje?
              </Text>
            </View>

            <Pressable
              hitSlop={8}
              style={s.notifBtn}
              onPress={() => navigation.navigate("Notificacoes")}
            >
              <AppIcon name="Bell" size={20} color={colors.textSecondary} strokeWidth={2} />
              {unreadMessages > 0 && (
                <View style={s.notifBadge}>
                  <Text allowFontScaling={false} style={s.notifBadgeText}>
                    {unreadMessages > 9 ? "9+" : unreadMessages}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* ── Hero card ── */}
          <LinearGradient
            colors={gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.hero}
          >
            {/* Text (left) + decorative illustration area (right) */}
            <View style={s.heroBody}>
              <View style={s.heroLeft}>
                <Text allowFontScaling={false} style={s.heroTitle}>
                  {"Encontre a diarista\n"}
                  <Text style={s.heroAccent}>ideal</Text>
                  {" para você"}
                </Text>
                <Text allowFontScaling={false} style={s.heroDesc}>
                  {"Profissionais de confiança\nperto de você. ❤️"}
                </Text>
              </View>

              {/* Illustration placeholder — replace with Image when asset is available */}
              <View style={s.heroIllus} pointerEvents="none">
                <View style={s.illusCircleLg} />
                <View style={s.illusCircleSm} />
                <View style={s.illusIconBox}>
                  <AppIcon
                    name="Sparkles"
                    size={26}
                    color="rgba(255,255,255,0.50)"
                    strokeWidth={1.6}
                  />
                </View>
              </View>
            </View>

            {/* Search bar */}
            <Pressable
              style={s.heroSearch}
              onPress={() => navigation.navigate("Buscar")}
            >
              <AppIcon name="Search" size={16} color={colors.textMuted} strokeWidth={2.1} />
              <Text allowFontScaling={false} style={s.heroSearchPlaceholder}>
                Buscar por bairro ou nome
              </Text>
              <View style={s.heroFilterBtn}>
                <AppIcon name="SlidersHorizontal" size={14} color={colors.white} strokeWidth={2.2} />
              </View>
            </Pressable>
          </LinearGradient>

          {/* ── Ações rápidas ── */}
          <View style={s.section}>
            <DSectionHeader
              title="Ações rápidas"
              action="Ver todas"
              onAction={() => navigation.navigate("Buscar")}
            />
            <View style={s.qaRow}>
              {quickActions.map((qa) => (
                <QuickActionCard key={qa.label} {...qa} />
              ))}
            </View>
          </View>

          {/* ── Categorias de profissional ── */}
          <View style={s.section}>
            <DSectionHeader title="Quem você precisa hoje?" />
            <View style={s.catGrid}>
              <CategoriaCard
                icon="WashingMachine"
                title="Diarista"
                onPress={() => navigation.navigate("Buscar")}
              />
              <CategoriaCard
                icon="Wrench"
                title="Montador"
                onPress={() =>
                  navigation.navigate("SolicitarServico", { categoriaInicial: "montador" })
                }
              />
              <CategoriaCard icon="Baby" title="Babá" disabled />
              <CategoriaCard icon="ChefHat" title="Cozinheira" disabled />
            </View>
          </View>

          {/* ── Profissionais sugeridas ── */}
          <View style={s.section}>
            <DSectionHeader
              title="Profissionais sugeridas"
              action="Ver todas"
              onAction={() => navigation.navigate("Buscar")}
            />

            {loading && !refreshing ? (
              <DSkeletonCard count={2} height={120} />
            ) : error ? (
              <DErrorState message={error} onRetry={() => handleBuscar()} />
            ) : (
              profissionals.map((prof) => (
                <SuggestedProfCard
                  key={prof.id}
                  prof={prof}
                  onPress={() =>
                    navigation.navigate("DiaristaProfile", {
                      diaristaId: prof.id,
                      nome: prof.nome,
                    })
                  }
                />
              ))
            )}
          </View>

          {/* ── Banner ── */}
          <View style={s.section}>
            <View style={s.banner}>
              <View style={s.bannerIconWrap}>
                <AppIcon name="Home" size={28} color={colors.primary} strokeWidth={2} />
                <Text style={s.bannerSparkle}>✦</Text>
              </View>
              <View style={s.bannerText}>
                <Text allowFontScaling={false} style={s.bannerTitle}>
                  Mais tempo para o que importa!
                </Text>
                <Text allowFontScaling={false} style={s.bannerSub}>
                  Conte com a Dular e tenha mais leveza no seu dia a dia.
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [s.bannerBtn, pressed && { opacity: 0.8 }]}
                onPress={() => navigation.navigate("Buscar")}
              >
                <Text allowFontScaling={false} style={s.bannerBtnText}>Saiba mais</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </View>
    </DScreen>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingBottom: 112,
    gap: spacing.sectionGap,
  },

  // ── Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 10,
    paddingBottom: spacing.sm,
  },
  headerCenter: {
    alignItems: "center",
    gap: 2,
  },
  notifBtn: {
    position: "absolute",
    right: spacing.screenPadding,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
    ...shadows.soft,
  },
  notifBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.notification,
    alignItems: "center",
    justifyContent: "center",
  },
  notifBadgeText: {
    color: colors.white,
    ...typography.caption,
    fontWeight: "700",
  },
  greeting: {
    ...typography.title,
    fontWeight: "700",
    color: colors.textPrimary,
    letterSpacing: -0.3,
    textAlign: "right",
  },
  greetingSub: {
    ...typography.bodySm,
    color: colors.textMuted,
    
    textAlign: "right",
  },

  // ── Hero card
  hero: {
    marginHorizontal: spacing.screenPadding,
    borderRadius: 18,
    padding: 16,
    overflow: "hidden",
    gap: spacing.md,
  },
  heroBody: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  heroLeft: {
    flex: 1,
    gap: spacing.xs,
  },
  heroTitle: {
    ...typography.h3,
    fontWeight: "700",
    color: colors.white,
    
  },
  heroAccent: {
    color: colors.notification,
  },
  heroDesc: {
    ...typography.bodySm,
    color: colors.whiteAlpha70,
    
    
    marginTop: 4,
  },
  // Illustration placeholder (right side of hero)
  heroIllus: {
    width: 92,
    height: 84,
  },
  illusCircleLg: {
    position: "absolute",
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.12)",
    top: -10,
    right: -8,
  },
  illusCircleSm: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,107,138,0.22)",
    bottom: -4,
    right: 14,
  },
  illusIconBox: {
    position: "absolute",
    top: 18,
    right: 18,
  },
  // Search bar
  heroSearch: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    height: 46,
    gap: spacing.sm,
  },
  heroSearchPlaceholder: {
    flex: 1,
    ...typography.bodySm,
    color: colors.textMuted,
    
  },
  heroFilterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Section wrapper
  section: {
    gap: 12,
    paddingHorizontal: spacing.screenPadding,
  },

  // ── Quick action cards
  qaRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  qaCard: {
    flex: 1,
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  qaCardPressed: {
    opacity: 0.75,
    backgroundColor: colors.lavender,
  },
  qaIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.lavender,
    alignItems: "center",
    justifyContent: "center",
  },
  qaLabel: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
    
  },

  // ── Professional card
  profCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 10,
    ...shadows.card,
  },
  // Avatar column (left)
  profAvatarCol: {
    alignItems: "center",
    gap: 6,
  },
  profAvatarWrap: {
    position: "relative",
  },
  onlineDot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.white,
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.notification,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  ratingPillStar: {
    ...typography.caption,
    color: colors.white,
    
  },
  ratingPillText: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.white,
    
  },
  // Info column (middle)
  profInfo: {
    flex: 1,
    gap: 3,
  },
  profName: {
    ...typography.bodySmMedium,
    fontWeight: "700",
    color: colors.textPrimary,
    
  },
  profYears: {
    ...typography.caption,
    color: colors.textMuted,
    
    
  },
  profLocRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  profLoc: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
    
  },
  availPill: {
    alignSelf: "flex-start",
    backgroundColor: "#F3F4F6",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginTop: 4,
  },
  availText: {
    ...typography.caption,
    
    color: colors.textSecondary,
    
  },
  // Price + button column (right)
  profPriceCol: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    alignSelf: "stretch",
  },
  profPriceGroup: {
    alignItems: "flex-end",
    gap: 1,
  },
  profPriceLabel: {
    ...typography.caption,
    color: colors.textMuted,
    
  },
  profPrice: {
    ...typography.bodyMedium,
    fontWeight: "700",
    color: colors.textPrimary,
    
  },
  profViewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  profViewText: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.white,
  },

  // ── Bottom banner
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.lavender,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.lavenderStrong,
  },
  bannerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    ...shadows.soft,
  },
  bannerSparkle: {
    position: "absolute",
    top: -4,
    right: -4,
    ...typography.bodySm,
    color: colors.primary,
  },
  bannerText: {
    flex: 1,
    gap: 3,
  },
  bannerTitle: {
    ...typography.bodySm,
    fontWeight: "700",
    color: colors.textPrimary,
    
  },
  bannerSub: {
    ...typography.caption,
    color: colors.textSecondary,
    
  },
  bannerBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  bannerBtnText: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.white,
  },

  // Categoria grid (Quem você precisa hoje?)
  catGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  catCard: {
    flexBasis: "48%",
    flexGrow: 1,
    minHeight: 78,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    ...shadows.soft,
  },
  catCardDisabled: {
    opacity: 0.6,
  },
  catIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lavenderSoft,
  },
  catIconWrapDisabled: {
    backgroundColor: colors.skeletonBg,
  },
  catTitle: {
    flex: 1,
    color: colors.textPrimary,
    ...typography.bodySmMedium,
    fontWeight: "700",
  },
  catTitleDisabled: {
    color: colors.textMuted,
  },
  catBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.warningSoft,
  },
  catBadgeText: {
    ...typography.caption,
    color: colors.warningDark,
    fontWeight: "800",
    fontSize: 10,
  },
});
