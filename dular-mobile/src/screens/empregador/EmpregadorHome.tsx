import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useBottomTabBarHeight, type BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import * as Location from "expo-location";

import { api } from "@/lib/api";
import type { BuscarDiaristasResponse, DiaristaItem } from "@/types/diarista";
import type { ServicoTipo, ServicoCategoria } from "@/types/servico";
import { CATEGORIAS, CATEGORIA_BY_KEY } from "@/constants/categorias";
import { PILOT_MODE, PILOT } from "@/config/pilotConfig";
import { fetchEnderecos, normalizarBairro, type Endereco } from "@/api/enderecoApi";
import { useGeoDefaults } from "@/hooks/useGeoDefaults";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import { useFavoritos } from "@/hooks/useFavoritos";
import { useAuth } from "@/stores/authStore";
import {
  AppIcon,
  type AppIconName,
  DAvatar,
  DScreen,
  DSectionHeader,
  DSkeletonCard,
  DErrorState,
  DEmptyState,
  ProfissionalCard,
  formatValorDiarista,
  type ProfissionalCardData,
} from "@/components/ui";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import { getProfileTheme } from "@/theme/profileTheme";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";
import { getBottomNavContentPadding } from "@/navigation/bottomNavLayout";

// Categorias em destaque na home (subconjunto da fonte única); demais em "Ver todos".
const CATEGORIAS_HOME = CATEGORIAS.filter((c) =>
  ["diarista", "montador", "baba", "cozinheira"].includes(c.key),
);

type Navigation = BottomTabNavigationProp<EmpregadorTabParamList>;
const EMPREGADOR_THEME = getProfileTheme({ role: "EMPREGADOR" });
const HOME_EMPREGADOR_LOGO = require("../../../assets/images/home_empregador/home_empregador_logo_card.png");

// ─── Suggested professionals ──────────────────────────────────────────────────

const DIARISTA_CAT = CATEGORIA_BY_KEY.diarista;

// Normaliza um item da busca para o card ÚNICO (ProfissionalCard). cidade/bairro
// vêm da região buscada quando o item não carrega os próprios.
function diaristaItemToCard(item: DiaristaItem, cidade: string, bairro: string): ProfissionalCardData {
  const extra = item as DiaristaItem & {
    fotoUrl?: string | null;
    cidade?: string | null;
    bairro?: string | null;
    user: { avatarUrl?: string | null };
  };
  return {
    id: item.user.id,
    userId: item.user.id,
    tipo: "DIARISTA",
    nome: item.user.nome,
    categoria: DIARISTA_CAT.label,
    categoriaIcon: DIARISTA_CAT.icon,
    categoriaColor: DIARISTA_CAT.fg,
    categoriaBg: DIARISTA_CAT.bg,
    avatarUrl: extra.fotoUrl ?? extra.user?.avatarUrl ?? null,
    cidade: extra.cidade ?? cidade ?? null,
    bairro: extra.bairro ?? bairro ?? null,
    valorLabel: formatValorDiarista(item.precoLeve),
    nota: item.notaMedia,
  };
}

// ── Proximidade (M5) ──────────────────────────────────────────────────────────
// Ordena os "Profissionais sugeridos" pela distância até a localização atual do
// empregador, usando os coords já existentes da profissional (sem alterar a
// ordenação global do endpoint). Sem coords → vai para o fim.
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function distanciaKm(item: DiaristaItem, origin: { lat: number; lng: number }): number {
  const lat = item.latitude;
  const lng = item.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return Number.POSITIVE_INFINITY;
  return haversineKm(origin.lat, origin.lng, lat, lng);
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
        <AppIcon name={icon} size={28} color={EMPREGADOR_THEME.textAccent} strokeWidth={2.2} />
      </View>
      <Text allowFontScaling={false} style={s.qaLabel}>{label}</Text>
    </Pressable>
  );
}

// Card de profissional unificado: ver components/ui/ProfissionalCard.

// ─── Categoria Card (grid "Quem você precisa hoje?") ─────────────────────────

function CategoriaCard({
  icon,
  title,
  onPress,
  disabled,
  color,
  bg,
}: {
  icon: AppIconName;
  title: string;
  onPress?: () => void;
  /** Mostra a tag "Em breve" e desabilita o toque. */
  disabled?: boolean;
  /** Cor oficial da categoria (Design System) — aplicada ao ícone. */
  color?: string;
  /** Fundo suave oficial da categoria — aplicado ao wrap do ícone. */
  bg?: string;
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
      <View
        style={[
          s.catIconWrap,
          !disabled && bg ? { backgroundColor: bg } : null,
          disabled && s.catIconWrapDisabled,
        ]}
      >
        <AppIcon
          name={icon}
          size={24}
          color={disabled ? colors.textMuted : color ?? colors.primary}
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

/** Teto da espera pelo endereço antes da primeira busca no piloto. */
const ESPERA_ENDERECO_MS = 3000;

/**
 * Piloto: bairro do endereço cadastrado — residencial antes do empresarial,
 * só se o endereço for da cidade do piloto. Sem endereço utilizável, "".
 */
function bairroDoEnderecoPiloto(lista: Endereco[]): string {
  const doPiloto = (e: Endereco) =>
    normalizarBairro(e.cidade) === normalizarBairro(PILOT.cidade) &&
    normalizarBairro(e.uf) === normalizarBairro(PILOT.uf);
  const endereco =
    lista.find((e) => e.tipo === "RESIDENCIAL" && doPiloto(e)) ??
    lista.find((e) => e.tipo === "EMPRESARIAL" && doPiloto(e));
  return endereco?.bairro.trim() ?? "";
}

export default function EmpregadorHome() {
  const bottomContentPadding = getBottomNavContentPadding(useBottomTabBarHeight(), spacing.xl);
  const navigation = useNavigation<Navigation>();
  const user = useAuth((state) => state.user);
  const geo = useGeoDefaults();
  const { unreadCount } = useNotificacoes();
  const { isFavorito, toggle: toggleFavorito } = useFavoritos();

  const firstName = useMemo(() => {
    const nome = (user?.nome || "").trim();
    return nome.split(/\s+/)[0] || "você";
  }, [user?.nome]);

  const [selectedTipo] = useState<ServicoTipo>("FAXINA");
  const [categoria] = useState<ServicoCategoria | null>("FAXINA_LEVE");
  const [diaristas, setDiaristas] = useState<DiaristaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cidade, setCidade] = useState(
    PILOT_MODE ? PILOT.cidade : (user?.cidadeAtual || user?.cidade || ""),
  );
  const [uf, setUf] = useState(
    PILOT_MODE ? PILOT.uf : (user?.estadoAtual || user?.estado || ""),
  );
  // Piloto: o bairro inicial vem do endereço cadastrado (efeito abaixo); sem
  // endereço, fica vazio e a busca cobre a cidade toda. Nunca o primeiro
  // bairro da lista do piloto nem a região do aparelho.
  const [bairro, setBairro] = useState(PILOT_MODE ? "" : (user?.bairroAtual || ""));
  const [enderecoPronto, setEnderecoPronto] = useState(!PILOT_MODE);
  // Rebusca pedida depois da primeira carga (endereço que chegou após o teto
  // ou relido ao focar). Executada quando não há busca em andamento.
  const [rebuscaPendente, setRebuscaPendente] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);


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
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        const cidadeParam = (cidade || geo.cidade || "").trim();
        const ufParam = (uf || geo.uf || "").trim();
        if (!cidadeParam || !ufParam) return;

        if (geo.coords && !coordsRef.current) {
          coordsRef.current = { lat: geo.coords.latitude, lng: geo.coords.longitude };
          setCoords(coordsRef.current);
        }

        // Piloto: a ordenação usa o GPS do aparelho. Geocodificar o bairro só
        // valeria se o usuário o trocasse à mão — e a Home não tem esse campo.
        const bairroQuery = bairro.trim();
        if (!PILOT_MODE && bairroQuery.length >= 3 && cidadeParam) {
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
        if (isRefresh) setRefreshing(false);
        else setLoading(false);
        busyRef.current = false;
      }
    },
    [bairro, categoria, cidade, geo.cidade, geo.coords, geo.loading, geo.uf, selectedTipo, uf],
  );

  useEffect(() => {
    handleBuscarRef.current = () => handleBuscar();
  }, [handleBuscar]);

  useEffect(() => {
    if (PILOT_MODE) return;
    const profileCidade = user?.cidadeAtual || user?.cidade || "";
    const profileUf = user?.estadoAtual || user?.estado || "";
    const profileBairro = user?.bairroAtual || "";
    if (profileCidade && !cidade) setCidade(profileCidade);
    if (profileUf && !uf) setUf(profileUf);
    if (profileBairro && !bairro) setBairro(profileBairro);
  }, [bairro, cidade, uf, user?.bairroAtual, user?.cidade, user?.cidadeAtual, user?.estado, user?.estadoAtual]);

  useEffect(() => {
    if (geo.loading || !geo.coords || appliedGeoRef.current) return;
    appliedGeoRef.current = true;
    const c = { lat: geo.coords.latitude, lng: geo.coords.longitude };
    coordsRef.current = c;
    setCoords(c);
    if (geo.cidade && !cidade) setCidade(geo.cidade);
    if (geo.uf && !uf) setUf(geo.uf);
    if (!PILOT_MODE && geo.bairro && !bairro) setBairro(geo.bairro);
  }, [bairro, cidade, geo.bairro, geo.cidade, geo.coords, geo.loading, geo.uf, uf]);

  // Piloto: a primeira busca espera o endereço cadastrado por até
  // ESPERA_ENDERECO_MS. Chegando antes, ele entra na primeira busca (uma só).
  // Passado o teto, a busca sai sem bairro (cidade toda); se o endereço chegar
  // depois, o bairro é aplicado e a lista é buscada uma vez mais.
  useEffect(() => {
    if (!PILOT_MODE) return;
    let vivo = true;
    let tetoAtingido = false;
    const teto = setTimeout(() => {
      tetoAtingido = true;
      setEnderecoPronto(true);
    }, ESPERA_ENDERECO_MS);
    fetchEnderecos()
      .then((lista) => {
        if (!vivo) return;
        const bairroEndereco = bairroDoEnderecoPiloto(lista);
        if (bairroEndereco) setBairro(bairroEndereco);
        if (tetoAtingido && bairroEndereco && initialFetchRef.current) setRebuscaPendente(true);
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(teto);
        if (vivo) setEnderecoPronto(true);
      });
    return () => {
      vivo = false;
      clearTimeout(teto);
    };
  }, []);

  useEffect(() => {
    if (geo.loading || !enderecoPronto || initialFetchRef.current) return;
    initialFetchRef.current = true;
    handleBuscarRef.current();
  }, [enderecoPronto, geo.loading]);

  useEffect(() => {
    if (!rebuscaPendente || geo.loading || loading || refreshing || busyRef.current) return;
    setRebuscaPendente(false);
    handleBuscarRef.current();
  }, [geo.loading, loading, rebuscaPendente, refreshing]);

  // Rebusca ao FOCAR (depois da primeira carga). A home monta uma vez e
  // sobrevive à navegação por abas: sem isto a lista de profissionais ficava
  // congelada na primeira busca — quem entrasse na plataforma depois só
  // aparecia no pull-to-refresh ou reiniciando o app.
  // Piloto: relê o endereço antes de rebuscar (pode ter mudado em outra tela).
  // Sem endereço utilizável, o bairro fica vazio; se a leitura falhar, a
  // rebusca segue com o bairro que já estava.
  useFocusEffect(
    useCallback(() => {
      if (geo.loading || !initialFetchRef.current) return;
      if (!PILOT_MODE) {
        handleBuscarRef.current();
        return;
      }
      let vivo = true;
      fetchEnderecos()
        .then((lista) => {
          if (vivo) setBairro(bairroDoEnderecoPiloto(lista));
        })
        .catch(() => {})
        .finally(() => {
          if (vivo) setRebuscaPendente(true);
        });
      return () => {
        vivo = false;
      };
    }, [geo.loading]),
  );

  const profissionals: ProfissionalCardData[] = useMemo(() => {
    if (diaristas.length === 0) return [];
    // M5: ordena por proximidade quando temos a localização atual do empregador;
    // sem coords, mantém a ordem que o backend devolveu.
    const ordered = coords
      ? [...diaristas].sort((a, b) => distanciaKm(a, coords) - distanciaKm(b, coords))
      : diaristas;
    return ordered.slice(0, 5).map((d) => diaristaItemToCard(d, cidade, bairro));
  }, [diaristas, cidade, bairro, coords]);

  const handleToggleFavorito = async (item: ProfissionalCardData) => {
    try {
      await toggleFavorito(item.userId, item.tipo);
    } catch {
      Alert.alert("Não foi possível atualizar", "Tente novamente em instantes. Verifique sua conexão.");
    }
  };

  const quickActions: QuickAction[] = [
    { icon: "FileText",      label: "Solicitações",  onPress: () => navigation.navigate("Agendamentos") },
    { icon: "Heart",         label: "Favoritos",     onPress: () => navigation.navigate("Favoritos") },
    { icon: "Clock",         label: "Histórico",     onPress: () => navigation.navigate("Historico") },
    { icon: "MessageCircle", label: "Mensagens",     onPress: () => navigation.navigate("Mensagens") },
  ];

  return (
    <DScreen backgroundColor={colors.background}>
      <View style={s.root}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.scroll, { paddingBottom: bottomContentPadding }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => handleBuscar(true)}
              tintColor={colors.primary}
            />
          }
        >
          {/* ── Header: avatar + saudação + sino (padrão Diarista/Montador) ── */}
          <View style={s.header}>
            <Pressable hitSlop={8} onPress={() => navigation.navigate("Perfil")} style={s.avatarRing}>
              <DAvatar size="md" uri={user?.avatarUrl ?? undefined} initials={firstName.slice(0, 2)} online />
            </Pressable>

            <View style={s.headerGreeting}>
              <Text allowFontScaling={false} style={s.greeting} numberOfLines={1}>
                Olá, {firstName}! 👋
              </Text>
              <Text allowFontScaling={false} style={s.greetingSub} numberOfLines={1}>
                O que vamos cuidar hoje?
              </Text>
            </View>

            <Pressable
              hitSlop={8}
              style={s.notifBtn}
              onPress={() => navigation.navigate("Notificacoes")}
            >
              <AppIcon name="Bell" size={20} color={EMPREGADOR_THEME.icon} strokeWidth={2.2} />
              {unreadCount > 0 && (
                <View style={s.notifBadge}>
                  <Text allowFontScaling={false} style={s.notifBadgeText}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* ── Hero card ── */}
          <LinearGradient
            colors={EMPREGADOR_THEME.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.hero}
          >
            {/* Text (left) */}
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
            </View>

            <View style={s.heroIllus} pointerEvents="none">
              <View style={s.heroHouseShadow}>
                <AppIcon name="Home" size={136} color="rgba(255,255,255,0.16)" strokeWidth={1.1} />
              </View>
              <Image source={HOME_EMPREGADOR_LOGO} style={s.heroLogoImage} resizeMode="contain" />
            </View>
          </LinearGradient>

          {/* ── Ações rápidas ── */}
          <View style={s.section}>
            <DSectionHeader
              title="Ações rápidas"
              action="Ver todas"
              onAction={() => navigation.navigate("AcoesRapidas")}
            />
            {/* SOS direto na Home (topo do bloco). Reutiliza a rota SosFlow. */}
            <Pressable
              onPress={() => navigation.navigate("SosFlow")}
              style={({ pressed }) => [s.sosCard, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel="SOS — acionar emergência"
            >
              <View style={s.sosIcon}>
                <AppIcon name="AlertTriangle" size={22} color={colors.danger} strokeWidth={2.3} />
              </View>
              <View style={s.sosText}>
                <Text allowFontScaling={false} style={s.sosTitle}>SOS / Emergência</Text>
                <Text allowFontScaling={false} style={s.sosSub} numberOfLines={1}>
                  Acione ajuda imediata em caso de emergência.
                </Text>
              </View>
              <AppIcon name="ChevronRight" size={18} color={colors.dangerDark} strokeWidth={2.2} />
            </Pressable>
            <View style={s.qaRow}>
              {quickActions.map((qa) => (
                <QuickActionCard key={qa.label} {...qa} />
              ))}
            </View>
          </View>

          {/* ── Categorias de profissional ── */}
          <View style={s.section}>
            <DSectionHeader
              title="Quem você precisa hoje?"
              action="Ver todos"
              actionColor={EMPREGADOR_THEME.primary}
              onAction={() => navigation.navigate("CategoriasTodas")}
            />
            <View style={s.catGrid}>
              {CATEGORIAS_HOME.map((c) => (
                <CategoriaCard
                  key={c.key}
                  icon={c.icon}
                  title={c.label}
                  color={c.fg}
                  bg={c.bg}
                  onPress={() => navigation.navigate("Buscar", { categoriaInicial: c.key })}
                />
              ))}
            </View>
          </View>

          {/* ── Profissionais sugeridas ── */}
          <View style={s.section}>
            <DSectionHeader
              title="Profissionais sugeridas"
              action="Ver todas"
              onAction={() => navigation.navigate("ProfissionaisSugeridos")}
            />

            {loading && !refreshing ? (
              <DSkeletonCard count={2} height={120} />
            ) : error ? (
              <DErrorState message={error} onRetry={() => handleBuscar()} />
            ) : profissionals.length === 0 ? (
              <DEmptyState
                icon="Search"
                title="Nenhum profissional sugerido ainda."
                subtitle="Toque em uma categoria acima para começar."
              />
            ) : (
              profissionals.map((prof) => (
                <ProfissionalCard
                  key={prof.id}
                  data={prof}
                  favorito={isFavorito(prof.userId, prof.tipo)}
                  onToggleFavorito={() => handleToggleFavorito(prof)}
                  onPress={() =>
                    navigation.navigate("DiaristaProfile", {
                      diaristaId: prof.userId,
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
    gap: spacing.sectionGap,
  },

  // ── Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 10,
    paddingBottom: spacing.sm,
  },
  avatarRing: {
    borderWidth: 2,
    borderColor: EMPREGADOR_THEME.primary,
    borderRadius: 999,
    padding: 2,
  },
  headerGreeting: {
    flex: 1,
    gap: 2,
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: EMPREGADOR_THEME.border,
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
  },
  greetingSub: {
    ...typography.bodySm,
    color: colors.textMuted,
  },

  // ── Hero card
  hero: {
    marginHorizontal: spacing.screenPadding,
    borderRadius: 18,
    padding: 16,
    overflow: "hidden",
    minHeight: 126,
  },
  heroBody: {
    minHeight: 94,
    justifyContent: "center",
    paddingRight: 112,
  },
  heroLeft: {
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
  heroIllus: {
    position: "absolute",
    top: 2,
    right: 0,
    bottom: -4,
    width: 150,
    alignItems: "center",
    justifyContent: "center",
  },
  heroHouseShadow: {
    position: "absolute",
    right: -2,
    bottom: -10,
    width: 150,
    height: 116,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  heroLogoImage: {
    position: "absolute",
    right: 10,
    bottom: 2,
    width: 128,
    height: 100,
    shadowColor: "#1F1728",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  // ── Section wrapper
  section: {
    gap: 12,
    paddingHorizontal: spacing.screenPadding,
  },

  // ── SOS (topo do bloco de Ações rápidas)
  sosCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.dangerSoft,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sosIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  sosText: {
    flex: 1,
    gap: 2,
  },
  sosTitle: {
    ...typography.bodySmMedium,
    fontWeight: "800",
    color: colors.dangerDark,
  },
  sosSub: {
    ...typography.caption,
    color: colors.textSecondary,
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
    backgroundColor: EMPREGADOR_THEME.primarySoft,
  },
  qaIconWrap: {
    width: 54,
    height: 50,
    borderRadius: 17,
    backgroundColor: EMPREGADOR_THEME.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  qaLabel: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
    
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
