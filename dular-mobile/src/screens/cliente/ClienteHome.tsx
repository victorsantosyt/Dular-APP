import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";

import { api } from "@/lib/api";
import { logoSource } from "@/lib/logoSource";
import { BuscarDiaristasResponse, DiaristaItem } from "@/types/diarista";
import {
  CriarServicoPayload,
  CriarServicoResponse,
  ServicoCategoria,
  ServicoTipo,
} from "@/types/servico";
import { getCatalogoServicos, type CatalogoTipo } from "@/api/catalogoApi";
import { PILOT_MODE, PILOT } from "@/config/pilotConfig";
import { useGeoDefaults } from "@/hooks/useGeoDefaults";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/stores/authStore";
import PaywallScreen from "@/screens/PaywallScreen";

import { colors, radius, shadow, spacing, typography } from "@/theme/tokens";
import ScreenBackground from "@/ui/ScreenBackground";

function iconByService(tipo: string): React.ComponentProps<typeof Ionicons>["name"] {
  if (tipo.includes("FAXINA")) return "home-outline";
  if (tipo.includes("PASSAR")) return "shirt-outline";
  if (tipo.includes("COZIN")) return "restaurant-outline";
  if (tipo.includes("PESADA")) return "hammer-outline";
  return "sparkles-outline";
}

function CategoryTile({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  active: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={({ pressed }) => [pressed && s.pressed]}>
      <Animated.View style={[s.categoryCard, active && s.categoryCardActive, { transform: [{ scale }] }]}> 
        <View style={s.categoryIconWrap}>
          <Ionicons name={icon} size={20} color={colors.greenDark} />
        </View>
        <Text style={s.categoryLabel} numberOfLines={2}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

function SolicitarButton({
  loading,
  disabled,
  onPress,
}: {
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={({ pressed }) => [pressed && s.pressed]}
    >
      <Animated.View style={[s.solicitarBtn, { transform: [{ scale }] }, disabled && s.solicitarBtnDisabled]}>
        {loading ? (
          <ActivityIndicator color={colors.card} size="small" />
        ) : (
          <Text style={s.solicitarText}>Solicitar</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

export default function ClienteHome() {
  const insets = useSafeAreaInsets();
  const user = useAuth((state) => state.user);
  const geo = useGeoDefaults();
  const { isBlocked, refresh: refreshSubscription } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);
  const nome = (user?.nome || "").trim();

  const [cidade, setCidade] = useState(PILOT_MODE ? PILOT.cidade : "Cuiaba");
  const [uf, setUf] = useState(PILOT_MODE ? PILOT.uf : "MT");
  const [bairro, setBairro] = useState(PILOT_MODE ? PILOT.bairros[0] : "Centro");
  const [bairroAtual, setBairroAtual] = useState<string>("");

  const [catalogo, setCatalogo] = useState<CatalogoTipo[]>([]);
  const [tipo, setTipo] = useState<ServicoTipo | null>("FAXINA");
  const [categoria, setCategoria] = useState<ServicoCategoria | null>("FAXINA_LEVE");
  const [turno] = useState<"MANHA" | "TARDE">("MANHA");
  const [diaristas, setDiaristas] = useState<DiaristaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [enderecoCompleto] = useState<string | null>(null);

  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const initialFetchRef = useRef(false);
  const appliedGeoDefaultsRef = useRef(false);
  const busyRef = useRef(false);
  const handleBuscarRef = useRef<() => void>(() => {});
  const itemAnimsRef = useRef<Animated.Value[]>([]);

  const canSearch = useMemo(
    () => Boolean((cidade?.trim() || geo.cidade) && (uf?.trim() || geo.uf)),
    [cidade, uf, geo.cidade, geo.uf]
  );

  const bairroEfetivo = useMemo(() => (bairro || bairroAtual || "").trim(), [bairro, bairroAtual]);

  const displayName = useMemo(() => {
    if (!nome) return "Cliente";
    return nome.split(/\s+/)[0] || "Cliente";
  }, [nome]);

  const toggleTipo = useCallback(
    (value: ServicoTipo) => {
      setTipo(value);
      const match = catalogo.find((entry) => entry.tipo === value);
      setCategoria((match?.categorias?.[0]?.categoria as ServicoCategoria) ?? null);
    },
    [catalogo]
  );

  const resolveCoordsForBairro = useCallback(async () => {
    const queryBairro = bairroEfetivo.trim();
    if (queryBairro.length < 3) {
      return coordsRef.current ?? (geo.coords ? { lat: geo.coords.latitude, lng: geo.coords.longitude } : null);
    }

    const query = cidade && uf ? `${queryBairro}, ${cidade}, ${uf}, Brasil` : `${queryBairro}, Brasil`;

    try {
      const geoRes = await Location.geocodeAsync(query);
      const found = geoRes?.[0];
      if (found?.latitude && found?.longitude) {
        return { lat: found.latitude, lng: found.longitude };
      }
    } catch {
      // fallback para coordenadas já disponíveis
    }

    return coordsRef.current ?? (geo.coords ? { lat: geo.coords.latitude, lng: geo.coords.longitude } : null);
  }, [bairroEfetivo, cidade, uf, geo.coords]);

  const handleBuscar = useCallback(
    async (isRefresh = false) => {
      if (geo.loading || busyRef.current) return;
      busyRef.current = true;
      try {
        setError(null);
        isRefresh ? setRefreshing(true) : setLoading(true);

        const coordsFinal = await resolveCoordsForBairro();
        if (coordsFinal) {
          coordsRef.current = coordsFinal;
          setCoords(coordsFinal);
        }

        const cidadeParam = (cidade || geo.cidade || "").trim();
        const ufParam = (uf || geo.uf || "").trim();
        if (!cidadeParam || !ufParam) throw new Error("Informe cidade e UF para buscar diaristas.");

        const params: Record<string, unknown> = {
          cidade: cidadeParam,
          uf: ufParam,
          bairro: bairroEfetivo,
          ...(tipo && { tipo }),
          ...(categoria && { categoria }),
          ...(coordsFinal?.lat && { lat: coordsFinal.lat, lng: coordsFinal.lng, precisao: "gps" }),
        };

        const res = await api.get<BuscarDiaristasResponse>("/api/diaristas/buscar", { params });
        setDiaristas(res.data.diaristas || []);
      } catch (e: any) {
        setError(e?.response?.data?.error ?? e?.message ?? "Falha ao buscar diaristas");
      } finally {
        isRefresh ? setRefreshing(false) : setLoading(false);
        busyRef.current = false;
      }
    },
    [bairroEfetivo, categoria, cidade, geo.cidade, geo.loading, geo.uf, resolveCoordsForBairro, tipo, uf]
  );

  async function criarServico(diaristaUserId: string) {
    try {
      setCreatingId(diaristaUserId);
      const payload: CriarServicoPayload = {
        tipo: tipo || "FAXINA",
        ...(categoria && { categoria }),
        dataISO: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        turno,
        cidade,
        uf,
        bairro,
        diaristaUserId,
        latitude: coords?.lat,
        longitude: coords?.lng,
        enderecoCompleto: enderecoCompleto || undefined,
        temPet: false,
        observacoes: "Pedido criado pelo app (MVP).",
      };
      const res = await api.post<CriarServicoResponse>("/api/servicos", payload);
      Alert.alert("Sucesso", `Serviço criado! ID: ${res.data.servicoId}`);
    } catch (e: any) {
      Alert.alert("Erro", e?.response?.data?.error ?? e?.message ?? "Falha ao criar serviço");
    } finally {
      setCreatingId(null);
    }
  }

  useEffect(() => {
    if (PILOT_MODE) {
      setCidade(PILOT.cidade);
      setUf(PILOT.uf);
      setBairro(PILOT.bairros[0]);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    getCatalogoServicos()
      .then((res) => {
        if (!mounted) return;
        const tipos = res?.tipos ?? [];
        setCatalogo(tipos);
        if (!tipo && tipos[0]) setTipo(tipos[0].tipo as ServicoTipo);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [tipo]);

  useEffect(() => {
    handleBuscarRef.current = () => handleBuscar();
  }, [handleBuscar]);

  useEffect(() => {
    if (geo.loading || !geo.coords) return;

    const nextCoords = { lat: geo.coords.latitude, lng: geo.coords.longitude };
    coordsRef.current = nextCoords;
    setCoords(nextCoords);

    if (appliedGeoDefaultsRef.current) return;
    appliedGeoDefaultsRef.current = true;

    if (geo.cidade) setCidade(geo.cidade);
    if (geo.uf) setUf(geo.uf);
    if (geo.bairro) {
      setBairroAtual(geo.bairro);
      setBairro((current) => (current?.trim() ? current : geo.bairro));
    }
  }, [geo.bairro, geo.cidade, geo.coords, geo.loading, geo.uf]);

  useEffect(() => {
    if (geo.loading || initialFetchRef.current) return;
    initialFetchRef.current = true;
    handleBuscarRef.current();
  }, [geo.loading]);

  useEffect(() => {
    itemAnimsRef.current = diaristas.map((_, index) => itemAnimsRef.current[index] ?? new Animated.Value(0));

    itemAnimsRef.current.forEach((anim) => anim.setValue(0));

    if (itemAnimsRef.current.length === 0) return;

    Animated.stagger(
      80,
      itemAnimsRef.current.map((anim) =>
        Animated.spring(anim, {
          toValue: 1,
          tension: 70,
          friction: 9,
          useNativeDriver: true,
        })
      )
    ).start();
  }, [diaristas]);

  return (
    <ScreenBackground noPadding>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}> 
        <View style={s.logoWrap}>
          <Image source={logoSource} style={s.logo} resizeMode="contain" />
        </View>
        <Text style={s.greeting} numberOfLines={1}>
          Olá, {displayName}
        </Text>
      </View>

      <ScrollView
        style={s.scrollView}
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => handleBuscar(true)} />}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => handleBuscar()}
          disabled={!canSearch || (loading && !refreshing) || geo.loading}
          style={({ pressed }) => [s.searchPill, pressed && s.pressed]}
        >
          <Ionicons name="search-outline" size={15} color={colors.sub} />
          <Text style={s.searchText} numberOfLines={1}>
            Buscar serviço de faxina...
          </Text>
          <View style={s.searchAction}>
            {loading && !refreshing ? (
              <ActivityIndicator size="small" color={colors.green} />
            ) : (
              <Ionicons name="search" size={14} color={colors.green} />
            )}
          </View>
        </Pressable>

        {geo.loading ? <Text style={s.geoHint}>Detectando sua localização...</Text> : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.categoriesRow}
        >
          {catalogo.map((entry) => (
            <CategoryTile
              key={entry.tipo}
              label={entry.label}
              icon={iconByService(entry.tipo)}
              active={tipo === entry.tipo}
              onPress={() => toggleTipo(entry.tipo as ServicoTipo)}
            />
          ))}
        </ScrollView>

        <Text style={s.sectionTitle}>Diaristas disponíveis</Text>

        {loading && !refreshing && !error ? (
          [0, 1, 2].map((index) => <View key={index} style={s.skeleton} />)
        ) : error ? (
          <View style={s.infoCard}>
            <Text style={s.errorTitle}>Não foi possível carregar.</Text>
            <Text style={s.errorSub}>{error}</Text>
            <Pressable style={({ pressed }) => [s.retryBtn, pressed && s.pressed]} onPress={() => handleBuscar()}>
              <Text style={s.retryText}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : diaristas.length === 0 ? (
          <View style={s.infoCard}>
            <Text style={s.emptyTitle}>Nada por aqui ainda</Text>
            <Text style={s.emptySub}>Tente ajustar os filtros e buscar novamente.</Text>
          </View>
        ) : (
          <FlashList<DiaristaItem>
            data={diaristas}
            estimatedItemSize={86}
            scrollEnabled={false}
            contentContainerStyle={s.listContent}
            renderItem={({ item, index }: ListRenderItemInfo<DiaristaItem>) => {
              const entryAnim = itemAnimsRef.current[index] ?? new Animated.Value(1);

              return (
                <Animated.View
                  style={[
                    s.diaristCard,
                    {
                      opacity: entryAnim,
                      transform: [
                        {
                          translateY: entryAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [16, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <View style={s.avatar}>
                    <Ionicons name="person" size={20} color={colors.card} />
                  </View>

                  <View style={s.diaristMain}>
                    <Text style={s.diaristName} numberOfLines={1}>{item.user.nome}</Text>
                    <Text style={s.diaristSub}>Confiável e experiente</Text>
                    <View style={s.ratingRow}>
                      <Text style={s.ratingStar}>⭐</Text>
                      <Text style={s.ratingText}>{item.notaMedia.toFixed(1)}</Text>
                    </View>
                  </View>

                  <SolicitarButton
                    onPress={() => {
                      if (isBlocked) { setShowPaywall(true); return; }
                      criarServico(item.user.id);
                    }}
                    loading={creatingId === item.user.id}
                    disabled={creatingId !== null && creatingId !== item.user.id}
                  />
                </Animated.View>
              );
            }}
          />
        )}
      </ScrollView>

      <Modal visible={showPaywall} animationType="slide" presentationStyle="pageSheet">
        <PaywallScreen
          onClose={() => {
            setShowPaywall(false);
            refreshSubscription();
          }}
        />
      </Modal>
    </ScreenBackground>
  );
}

const s = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 8,
    alignItems: "center",
  },
  logoWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  logo: {
    width: 126,
    height: 66,
  },
  greeting: {
    width: "100%",
    alignSelf: "flex-start",
    marginTop: 4,
    fontSize: 24,
    fontWeight: "900",
    color: colors.ink,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: 2,
    paddingBottom: 110,
  },
  searchPill: {
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    ...shadow.card,
  },
  searchText: {
    flex: 1,
    color: colors.sub,
    fontSize: 12,
    fontWeight: "500",
  },
  searchAction: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.greenLight,
    alignItems: "center",
    justifyContent: "center",
  },
  geoHint: {
    ...typography.sub,
    textAlign: "center",
    marginTop: 8,
  },
  categoriesRow: {
    gap: 10,
    paddingTop: 10,
    paddingBottom: 10,
    paddingRight: 4,
  },
  categoryCard: {
    width: 82,
    height: 80,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 6,
    ...shadow.card,
  },
  categoryCardActive: {
    borderColor: colors.green,
  },
  categoryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.greenLight,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryLabel: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "700",
    color: colors.ink,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.ink,
    paddingBottom: 8,
    paddingTop: 2,
  },
  skeleton: {
    height: 84,
    borderRadius: 16,
    backgroundColor: colors.card,
    opacity: 0.55,
    marginBottom: 9,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    gap: spacing.xs,
    ...shadow.card,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.danger,
  },
  errorSub: {
    ...typography.sub,
  },
  retryBtn: {
    marginTop: spacing.xs,
    height: 42,
    borderRadius: radius.btn,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: {
    color: colors.card,
    fontSize: 13,
    fontWeight: "800",
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.ink,
  },
  emptySub: {
    ...typography.sub,
  },
  listContent: {
    gap: 9,
  },
  diaristCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 13,
    gap: 11,
    flexDirection: "row",
    alignItems: "center",
    ...shadow.card,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  diaristMain: {
    flex: 1,
    gap: 1,
  },
  diaristName: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.ink,
  },
  diaristSub: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.sub,
    marginTop: 1,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  ratingStar: {
    color: colors.star,
    fontSize: 12,
  },
  ratingText: {
    color: colors.star,
    fontSize: 12,
    fontWeight: "700",
  },
  solicitarBtn: {
    borderRadius: radius.pill,
    backgroundColor: colors.green,
    paddingVertical: 8,
    paddingHorizontal: 14,
    minWidth: 86,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 2,
  },
  solicitarBtnDisabled: {
    opacity: 0.6,
  },
  solicitarText: {
    color: colors.card,
    fontSize: 12,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.8,
  },
});
