import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  Alert,
  Pressable,
  Image,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { api } from "../../lib/api";
import { BuscarDiaristasResponse, DiaristaItem } from "../../types/diarista";
import { CriarServicoPayload, CriarServicoResponse, ServicoTipo, ServicoCategoria } from "../../types/servico";
import { getCatalogoServicos, type CatalogoTipo } from "../../api/catalogoApi";
import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { logoSource } from "../../lib/logoSource";
import { PILOT_MODE, PILOT } from "../../config/pilotConfig";
import { useGeoDefaults } from "../../hooks/useGeoDefaults";
import { useAuth } from "../../stores/authStore";
import ScreenBackground from "../../ui/ScreenBackground";
import { SearchPill } from "../../ui/SearchPill";
import { CategoryCard } from "../../ui/CategoryCard";
import { GlassCard } from "../../ui/GlassCard";
import { SectionTitle } from "../../ui/SectionTitle";
import { colors, radius, shadow } from "../../ui/tokens";
import { DButton } from "../../components/DButton";

const norm = (s: string) =>
  (s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const uniqByName = (arr: string[]) => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const b of arr) {
    const k = norm(b);
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(b.trim());
  }
  return out;
};

export default function ClienteHome() {
  const insets = useSafeAreaInsets();
  const user = useAuth((s) => s.user);
  const geo = useGeoDefaults();
  const nome = (user?.nome || "").trim();
  const [cidade, setCidade] = useState(PILOT_MODE ? PILOT.cidade : "Cuiaba");
  const [uf, setUf] = useState(PILOT_MODE ? PILOT.uf : "MT");
  const [bairro, setBairro] = useState(PILOT_MODE ? PILOT.bairros[0] : "Centro");
  const [bairroAtual, setBairroAtual] = useState<string>("");
  const [bairroSelecionado, setBairroSelecionado] = useState<string>("");
  const [bairrosChips, setBairrosChips] = useState<string[]>([]);

  const [catalogo, setCatalogo] = useState<CatalogoTipo[]>([]);
  const [tipo, setTipo] = useState<ServicoTipo | null>("FAXINA");
  const [categoria, setCategoria] = useState<ServicoCategoria | null>("FAXINA_LEVE");
  const [turno, setTurno] = useState<"MANHA" | "TARDE">("MANHA");
  const [diaristas, setDiaristas] = useState<DiaristaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const [enderecoCompleto, setEnderecoCompleto] = useState<string | null>(null);
  const initialFetchRef = useRef(false);
  const appliedGeoDefaultsRef = useRef(false);
  const busyRef = useRef(false);
  const handleBuscarRef = useRef<() => void>(() => {});
  const canSearch = useMemo(
    () => Boolean((cidade?.trim() || geo.cidade) && (uf?.trim() || geo.uf)),
    [cidade, uf, geo.cidade, geo.uf]
  );
  const onPickBairroChip = useCallback((b: string) => {
    setBairroSelecionado((cur) => {
      const same = norm(cur) === norm(b);
      setBairro(same ? "" : b);
      return same ? "" : b;
    });
  }, []);
  const toggleTipo = useCallback(
    (val: ServicoTipo) => {
      setTipo(val);
      const match = catalogo.find((t) => t.tipo === val);
      const firstCat = match?.categorias?.[0]?.categoria as ServicoCategoria | undefined;
      setCategoria(firstCat ?? null);
    },
    [catalogo]
  );

  const selectedTipo = useMemo(() => catalogo.find((t) => t.tipo === tipo), [catalogo, tipo]);

  const bairroEfetivo = useMemo(() => {
    return (bairroSelecionado || bairro || bairroAtual || "").trim();
  }, [bairroSelecionado, bairro, bairroAtual]);

  const resolveCoordsForBairro = useCallback(async () => {
    const q = bairroEfetivo.trim();
    if (q.length < 3) return coordsRef.current || (geo.coords ? { lat: geo.coords.latitude, lng: geo.coords.longitude } : null);

    const query = cidade && uf ? `${q}, ${cidade}, ${uf}, Brasil` : `${q}, Brasil`;
    try {
      const geoRes = await Location.geocodeAsync(query);
      const found = geoRes?.[0];
      if (found?.latitude && found?.longitude) {
        return { lat: found.latitude, lng: found.longitude };
      }
    } catch {
      // segue com coords atuais
    }
    return coordsRef.current || (geo.coords ? { lat: geo.coords.latitude, lng: geo.coords.longitude } : null);
  }, [bairroEfetivo, cidade, uf, geo.coords]);

  const handleBuscar = useCallback(
    async (isRefresh = false) => {
      if (geo.loading) return;
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        setError(null);
        isRefresh ? setRefreshing(true) : setLoading(true);

        const coordsFinal = await resolveCoordsForBairro();
        if (coordsFinal) {
          coordsRef.current = coordsFinal;
          setCoords({ lat: coordsFinal.lat, lng: coordsFinal.lng });
        }

        const cidadeParam = (cidade || geo.cidade || "").trim();
        const ufParam = (uf || geo.uf || "").trim();
        if (!cidadeParam || !ufParam) {
          throw new Error("Informe cidade e UF para buscar diaristas.");
        }

        const params: any = {
          cidade: cidadeParam,
          uf: ufParam,
          bairro: bairroEfetivo,
        };

        if (tipo) params.tipo = tipo;
        if (categoria) params.categoria = categoria;

        if (coordsFinal?.lat && coordsFinal?.lng) {
          params.lat = coordsFinal.lat;
          params.lng = coordsFinal.lng;
          params.precisao = "gps";
        }

        const res = await api.get<BuscarDiaristasResponse>("/api/diaristas/buscar", { params });
        setDiaristas(res.data.diaristas || []);
      } catch (e: any) {
        const msg = e?.response?.data?.error ?? e?.message ?? "Falha ao buscar diaristas";
        setError(msg);
      } finally {
        isRefresh ? setRefreshing(false) : setLoading(false);
        busyRef.current = false;
      }
    },
    [bairroEfetivo, cidade, uf, tipo, categoria, resolveCoordsForBairro, geo.loading]
  );

  async function criarServico(diaristaUserId: string) {
    try {
      setLoading(true);

      const dataISO = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const payload: CriarServicoPayload = {
        tipo: tipo || "FAXINA",
        ...(categoria ? { categoria } : {}),
        dataISO,
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
      setLoading(false);
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
    if (geo.loading) return;
    if (!geo.coords) return;

    const nextCoords = { lat: geo.coords.latitude, lng: geo.coords.longitude };
    coordsRef.current = nextCoords;
    setCoords(nextCoords);

    if (appliedGeoDefaultsRef.current) return;
    appliedGeoDefaultsRef.current = true;

    if (geo.cidade) setCidade(geo.cidade);
    if (geo.uf) setUf(geo.uf);
    if (geo.bairro) {
      setBairroAtual(geo.bairro);
      setBairro((cur) => (cur?.trim() ? cur : geo.bairro));
    }
  }, [geo.loading, geo.coords, geo.cidade, geo.uf, geo.bairro]);

  useEffect(() => {
    const list = uniqByName([bairroAtual, ...PILOT.bairros]);
    setBairrosChips(list);
  }, [bairroAtual]);

  useEffect(() => {
    if (geo.loading) return;
    if (initialFetchRef.current) return;
    initialFetchRef.current = true;
    handleBuscarRef.current();
  }, [geo.loading]);

  const displayName = useMemo(() => {
    if (!nome) return "Cliente";
    const first = nome.split(/\s+/)[0];
    return first || "Cliente";
  }, [nome]);

  return (
    <ScreenBackground>
      {/* Header */}
      <View style={{ paddingTop: insets.top + 8, alignItems: "center" }}>
        <Image source={logoSource} style={{ width: 160, height: 90, resizeMode: "contain", marginBottom: 8 }} />
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{
            fontSize: 24,
            fontWeight: "700",
            color: colors.ink,
            textAlign: "center",
            paddingHorizontal: 6,
            lineHeight: 30,
          }}
        >
          Olá, {displayName}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 26, gap: 14 }}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => handleBuscar(true)} />}
      >
        {geo.loading && (
          <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center" }}>Detectando sua localização...</Text>
        )}

        {/* Busca rápida */}
        <SearchPill
          placeholder="Buscar serviço de faxina..."
          value={bairro}
          onChangeText={(t) => {
            setBairro(t);
            setBairroSelecionado("");
          }}
          onSubmit={() => handleBuscar()}
          editable={!PILOT_MODE}
        />

        {/* Tags principais */}
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          {catalogo.map((t) => (
            <CategoryCard
              key={t.tipo}
              label={t.label}
              icon={<MaterialCommunityIcons name="tag" size={22} color={colors.brand} />}
              selected={tipo === t.tipo}
              onPress={() => toggleTipo(t.tipo as ServicoTipo)}
            />
          ))}
        </View>

        {/* Form principal */}
        <GlassCard style={{ gap: 10 }}>
          <Text style={{ fontWeight: "700", color: colors.ink }}>Busque por serviço</Text>

          <View style={{ gap: 8 }}>
            <View style={inputRow}>
              <Text style={inputLabel}>Cidade</Text>
              <Pressable disabled={PILOT_MODE} style={inputBox}>
                <Text style={inputText}>{cidade}</Text>
              </Pressable>
            </View>
            <View style={inputRow}>
              <Text style={inputLabel}>UF</Text>
              <Pressable disabled={PILOT_MODE} style={inputBox}>
                <Text style={inputText}>{uf}</Text>
              </Pressable>
            </View>

            {PILOT_MODE ? (
              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Bairros do piloto</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {bairrosChips.map((b) => {
                    const active = norm(bairroSelecionado || bairro) === norm(b);
                    return (
                      <Pressable key={b} onPress={() => onPickBairroChip(b)} style={[pill, active && pillOn]}>
                        <Text style={[pillText, active && pillTextOn]}>{b}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : (
              <View style={inputRow}>
                <Text style={inputLabel}>Bairro</Text>
                <Pressable style={inputBox}>
                  <Text style={inputText}>{bairro || "Informe o bairro"}</Text>
                </Pressable>
              </View>
            )}
          </View>

          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            {selectedTipo?.categorias?.length ? (
              selectedTipo.categorias.map((c) => (
                <Pressable
                  key={c.categoria}
                  onPress={() => setCategoria(c.categoria as ServicoCategoria)}
                  style={[pill, categoria === c.categoria && pillOn]}
                >
                  <Text style={[pillText, categoria === c.categoria && pillTextOn]}>{c.label}</Text>
                </Pressable>
              ))
            ) : (
              <Pressable style={[pill, pillOn]}>
                <Text style={[pillText, pillTextOn]}>Sem categorias</Text>
              </Pressable>
            )}
            <Pressable onPress={() => setTurno("MANHA")} style={[pill, turno === "MANHA" && pillOn]}>
              <Text style={[pillText, turno === "MANHA" && pillTextOn]}>Manhã</Text>
            </Pressable>
            <Pressable onPress={() => setTurno("TARDE")} style={[pill, turno === "TARDE" && pillOn]}>
              <Text style={[pillText, turno === "TARDE" && pillTextOn]}>Tarde</Text>
            </Pressable>
          </View>

          <DButton
            title="Buscar diaristas"
            onPress={() => handleBuscar()}
            loading={loading}
            disabled={!canSearch || loading || geo.loading}
            style={{ marginTop: 4 }}
          />
        </GlassCard>

        {/* Lista / estados */}
        <SectionTitle title="Diaristas disponíveis" />

        {loading && !error ? (
          <View style={{ marginTop: 4, padding: 16, borderRadius: radius.lg, backgroundColor: colors.card, opacity: 0.6 }}>
            <View style={{ height: 16, borderRadius: 8, backgroundColor: "#E5E7EB" }} />
            <View style={{ height: 16, marginTop: 10, borderRadius: 8, backgroundColor: "#E5E7EB" }} />
            <View style={{ height: 16, marginTop: 10, borderRadius: 8, backgroundColor: "#E5E7EB" }} />
          </View>
        ) : error ? (
          <GlassCard style={{ gap: 8 }}>
            <Text style={{ color: colors.danger, fontWeight: "800" }}>Não foi possível carregar.</Text>
            <Text style={{ color: colors.muted }}>{error}</Text>
            <TouchableOpacity
              onPress={() => handleBuscar(false)}
              style={{
                marginTop: 8,
                height: 44,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.ink,
              }}
            >
              <Text style={{ color: "white", fontWeight: "800" }}>Tentar novamente</Text>
            </TouchableOpacity>
          </GlassCard>
        ) : diaristas.length === 0 ? (
          <GlassCard style={{ gap: 6 }}>
            <Text style={{ fontWeight: "800", color: colors.ink }}>Nada por aqui ainda</Text>
            <Text style={{ color: colors.muted }}>Tente ajustar o bairro ou fazer uma busca diferente.</Text>
          </GlassCard>
        ) : (
          <FlashList<DiaristaItem>
            data={diaristas}
            estimatedItemSize={150}
            scrollEnabled={false}
            contentContainerStyle={{ gap: 10 }}
            renderItem={({ item }: ListRenderItemInfo<DiaristaItem>) => (
              <GlassCard style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: "#dceeed",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="person-circle" size={52} color={colors.brand} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: colors.ink }}>{item.user.nome}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>Confiável e experiente</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Ionicons name="star" size={14} color={colors.star} />
                    <Text style={{ color: colors.ink }}>{item.notaMedia.toFixed(1)}</Text>
                  </View>
                </View>
                <DButton
                  title="Solicitar"
                  onPress={() => criarServico(item.user.id)}
                  loading={creatingId === item.user.id}
                  disabled={creatingId !== null && creatingId !== item.user.id}
                  style={{ minWidth: 96 }}
                />
              </GlassCard>
            )}
          />
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

const pill = {
  borderWidth: 1,
  borderColor: colors.stroke,
  borderRadius: radius.pill,
  paddingVertical: 10,
  paddingHorizontal: 14,
  backgroundColor: "#f8fafc",
};

const pillOn = {
  borderColor: colors.brand,
  backgroundColor: "rgba(25,178,126,0.15)",
};

const pillText = { color: colors.ink };
const pillTextOn = { color: colors.brand, fontWeight: "700" };

const inputRow: ViewStyle = { gap: 4 };
const inputLabel = { color: colors.muted, fontSize: 12 };
const inputBox: ViewStyle = {
  borderWidth: 1,
  borderColor: colors.stroke,
  borderRadius: radius.md,
  paddingVertical: 10,
  paddingHorizontal: 12,
  backgroundColor: colors.cardStrong,
};
const inputText = { color: colors.ink, fontSize: 14 };
