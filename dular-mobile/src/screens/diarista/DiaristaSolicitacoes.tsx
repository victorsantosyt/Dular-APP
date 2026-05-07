import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  Alert,
  Animated,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";

import { api } from "@/lib/api";
import type { MinhasResponse, ServicoListItem as Servico } from "../../../../shared/types/servico";
import { startLocationWatcher, type LocationUpdate } from "@/lib/location";
import { logoSource } from "@/lib/logoSource";
import { DularBadge } from "@/components/DularBadge";
import { SafeScoreBadge } from "@/components/SafeScoreBadge";
import { AppIcon } from "@/components/ui";
import { SOSIcon } from "@/assets/icons";
import { CenterWrap } from "@/ui/Layout";
import { DIARISTA_STACK_ROUTES } from "@/navigation/routes";
import { useSubscription } from "@/hooks/useSubscription";
import PaywallScreen from "@/screens/PaywallScreen";
import { colors, radius, shadow, spacing, typography } from "@/theme/tokens";

const FINISHED_STATUS = new Set([
  "CONCLUIDO",
  "CONCLUÍDO",
  "CONFIRMADO",
  "FINALIZADO",
  "FINALIZADO_CLIENTE",
  "PAGO",
  "AVALIADO",
]);

type SafeScoreSummary = {
  faixa: string;
  cor: string;
  bloqueado: boolean;
  totalServicos: number;
  verificado: boolean;
};

function upper(v: unknown) {
  return String(v ?? "").toUpperCase();
}

function moneyBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dateLabel(dateValue?: string | Date) {
  const value = dateValue ? new Date(dateValue) : new Date();
  return value.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function getServicoEndereco(servico: Servico | null | undefined) {
  const endereco = servico?.enderecoCompleto ?? null;
  return typeof endereco === "string" && endereco.trim() ? endereco.trim() : null;
}

async function getCurrentCoords() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") {
    throw new Error("Permissão de localização não concedida.");
  }

  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
  };
}

export default function DiaristaSolicitacoes({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { isBlocked, refresh: refreshSubscription } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);

  const [items, setItems] = useState<Servico[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [pendenteOpen, setPendenteOpen] = useState(true);
  const [agendaOpen, setAgendaOpen] = useState(true);
  const [aceitando, setAceitando] = useState(false);
  const [checkinOk, setCheckinOk] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [scoreByUser, setScoreByUser] = useState<Record<string, SafeScoreSummary>>({});

  const scrollRef = useRef<ScrollView>(null);
  const locationSub = useRef<Location.LocationSubscription | null>(null);

  const pendingAnim = useRef(new Animated.Value(0)).current;
  const pendingSlide = useRef(new Animated.Value(24)).current;

  const pending = useMemo(() => items.find((s) => s.status === "SOLICITADO") ?? null, [items]);
  const pendingCount = useMemo(() => items.filter((s) => s.status === "SOLICITADO").length, [items]);
  const others = useMemo(() => items.filter((s) => s.id !== pending?.id), [items, pending?.id]);
  const pendingClientScore = pending?.cliente?.id ? scoreByUser[pending.cliente.id] : undefined;

  const ganhosMes = useMemo(() => {
    const totalCents = items
      .filter((item) => FINISHED_STATUS.has(upper(item.status)))
      .reduce((sum, item) => sum + (item.precoFinal ?? 0), 0);
    return totalCents / 100;
  }, [items]);

  const displayName = useMemo(() => {
    const raw =
      pending?.diarista?.nome ||
      "Mariana";
    return raw.trim() || "Mariana";
  }, [pending]);

  const securityLevel = pending?.securityLevel ?? "NORMAL";

  const onLocationUpdate = useCallback((data: LocationUpdate) => {
    const { latitude, longitude } = data.coords;
    setCoords({ lat: latitude, lng: longitude });
  }, []);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await api.get<MinhasResponse>("/api/servicos/minhas");
      const list = res.data.servicos || [];
      setItems(list);

      const clientIds = Array.from(
        new Set(list.map((item) => item.cliente?.id).filter(Boolean) as string[])
      );
      if (clientIds.length) {
        const entries = await Promise.all(
          clientIds.map(async (id) => {
            try {
              const scoreRes = await api.get<SafeScoreSummary>(`/api/usuarios/${id}/score`);
              return [id, scoreRes.data] as const;
            } catch {
              return null;
            }
          })
        );
        setScoreByUser((cur) => ({
          ...cur,
          ...Object.fromEntries(entries.filter(Boolean) as [string, SafeScoreSummary][]),
        }));
      }
    } catch (e: any) {
      Alert.alert("Erro", e?.response?.data?.error ?? e?.message ?? "Falha ao carregar");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const aceitarServico = useCallback(async (servico: Servico) => {
    const endereco = getServicoEndereco(servico);
    try {
      setAceitando(true);
      await api.post(`/api/servicos/${servico.id}/aceitar`, endereco ? { enderecoCompleto: endereco } : {});
      await load();
    } catch (e: any) {
      Alert.alert("Erro", e?.response?.data?.error ?? e?.message ?? "Falha ao aceitar");
    } finally {
      setAceitando(false);
    }
  }, [load]);

  const confirmarAceite = useCallback((servico: Servico) => {
    if (!getServicoEndereco(servico)) {
      Alert.alert(
        "Endereço não informado",
        "Endereço não informado pelo cliente. Confirma mesmo assim?",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Confirmar", onPress: () => { void aceitarServico(servico); } },
        ]
      );
      return;
    }

    void aceitarServico(servico);
  }, [aceitarServico]);

  const onAceitar = useCallback(async () => {
    if (!pending?.id) return;
    if (isBlocked) { setShowPaywall(true); return; }

    if (pendingClientScore?.bloqueado) {
      Alert.alert(
        "Atenção",
        "Atenção: este cliente está com restrições ativas. Deseja continuar?",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Continuar", onPress: () => confirmarAceite(pending) },
        ]
      );
      return;
    }

    confirmarAceite(pending);
  }, [confirmarAceite, isBlocked, pending, pendingClientScore?.bloqueado]);

  const onRecusar = useCallback(async () => {
    if (!pending?.id) return;
    try {
      await api.post(`/api/servicos/${pending.id}/recusar`);
      await load();
    } catch (e: any) {
      Alert.alert("Erro", e?.response?.data?.error ?? e?.message ?? "Falha ao recusar");
    }
  }, [pending?.id, load]);

  const doCheckin = useCallback(async () => {
    if (!pending?.id) return;
    try {
      const current = await getCurrentCoords();
      await api.post("/api/seguranca/checkin", {
        servicoId: pending.id,
        latitude: current.latitude,
        longitude: current.longitude,
      });
      setCoords({ lat: current.latitude, lng: current.longitude });
      setCheckinOk(true);
    } catch (e: any) {
      Alert.alert("Check-in", e?.response?.data?.error ?? e?.message ?? "Não foi possível registrar o check-in.");
    }
  }, [pending?.id]);

  const openSOS = useCallback(async () => {
    const mensagem = "Preciso de ajuda em um atendimento (Dular).";
    let current: { latitude: number; longitude: number } | null = null;

    try {
      current = await getCurrentCoords();
      setCoords({ lat: current.latitude, lng: current.longitude });
    } catch (err) {
      console.error("[SOS] falha ao obter localização:", err);
    }

    try {
      await api.post("/api/seguranca/sos", {
        servicoId: pending?.id,
        ...(current ? { latitude: current.latitude, longitude: current.longitude } : {}),
        mensagem,
      });
    } catch (err) {
      console.error("[SOS] falha ao registrar no backend:", err);
    }

    const phone = "5565999990000";
    const msg = encodeURIComponent(mensagem);
    const url = `https://wa.me/${phone}?text=${msg}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert("SOS", "Não foi possível abrir o WhatsApp.");
      return;
    }
    Linking.openURL(url);
  }, [pending?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
      (async () => {
        try {
          locationSub.current = await startLocationWatcher(onLocationUpdate);
        } catch {
          // sem localização
        }
      })();
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: false }));
      return () => {
        locationSub.current?.remove();
        locationSub.current = null;
      };
    }, [load, onLocationUpdate])
  );

  useEffect(() => {
    if (!pending) return;
    pendingAnim.setValue(0);
    pendingSlide.setValue(24);

    Animated.parallel([
      Animated.timing(pendingAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(pendingSlide, {
        toValue: 0,
        tension: 70,
        friction: 9,
        useNativeDriver: true,
      }),
    ]).start();
  }, [pending, pendingAnim, pendingSlide]);

  const todayText = useMemo(() => dateLabel(), []);
  const agendaTitle = useMemo(() => dateLabel(others[0]?.data ?? undefined), [others]);

  return (
    <SafeAreaView style={s.safe} edges={["left", "right", "top"]}>
      <ScrollView
        ref={scrollRef}
        style={s.scrollView}
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
      >
        <View style={[s.header, { paddingTop: insets.top + 12 }]}> 
          <View style={s.logoWrap}>
            <Image source={logoSource} style={s.logo} resizeMode="contain" />
          </View>

          <View style={s.headerRow}>
            <Text style={s.greeting} numberOfLines={1}>
              Olá, {displayName}
            </Text>
            <View style={s.earningsWrap}>
              <Text style={s.earningsValue}>{moneyBRL(ganhosMes)}</Text>
              <Text style={s.earningsLabel}>Ganhos do mês</Text>
            </View>
          </View>
        </View>

        <CenterWrap mt={8}>
          {pending ? (
            <Animated.View
              style={{
                opacity: pendingAnim,
                transform: [{ translateY: pendingSlide }],
              }}
            >
              <LinearGradient
                colors={[colors.greenDark, colors.green]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.pendingCard}
              >
                <View style={s.pendingTopRow}>
                  <View style={s.pendingTopLeft}>
                    <View style={s.pendingPersonBadge}>
                      <Ionicons name="person" size={16} color={colors.card} />
                    </View>
                    <Text style={s.pendingTopText}>{pendingCount} Pendente(s)</Text>
                  </View>
                  <Pressable onPress={() => setPendenteOpen((v) => !v)} style={({ pressed }) => [pressed && s.pressed]}>
                    <Ionicons name={pendenteOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.card} />
                  </Pressable>
                </View>

                {pendenteOpen ? (
                  <>
                    <Text style={s.pendingTitle} numberOfLines={2}>
                      {pending.tipo} • {pending.turno}
                    </Text>

                    {pendingClientScore ? (
                      <SafeScoreBadge {...pendingClientScore} style={s.pendingScore} />
                    ) : null}

                    <View style={s.pendingFooterRow}>
                      <View style={s.pendingMetaRow}>
                        <View style={s.pendingMetaChip}>
                          <Ionicons name="time-outline" size={13} color={colors.card} />
                          <Text style={s.pendingMetaText}>2H</Text>
                        </View>
                        <View style={s.pendingMetaChip}>
                          <Ionicons name="star" size={13} color={colors.card} />
                          <Text style={s.pendingMetaText}>5.0</Text>
                        </View>
                      </View>

                      <Pressable
                        onPress={onAceitar}
                        disabled={aceitando}
                        style={({ pressed }) => [s.acceptBtn, pressed && s.pressed, aceitando && s.disabledBtn]}
                      >
                        <Text style={s.acceptText}>{aceitando ? "..." : "Aceitar"}</Text>
                      </Pressable>
                    </View>

                    {securityLevel === "REFORCADO" ? (
                      <Pressable onPress={onRecusar} style={({ pressed }) => [s.rejectBtn, pressed && s.pressed]}>
                        <Text style={s.rejectText}>Recusar</Text>
                      </Pressable>
                    ) : null}
                  </>
                ) : null}
              </LinearGradient>
            </Animated.View>
          ) : null}

          <View style={s.dateRow}>
            <AppIcon name="Calendar" size={15} color={colors.sub} />
            <Text style={s.dateText}>{todayText}</Text>
          </View>

          {pending ? (
            <View style={s.securityCard}>
              <Text style={s.securityTitle}>Segurança</Text>
              <Text style={s.securitySub}>Use o SOS se se sentir em risco. O check-in é opcional.</Text>

              <View style={s.securityBtnRow}>
                <Pressable
                  onPress={doCheckin}
                  style={({ pressed }) => [
                    s.checkinBtn,
                    checkinOk && s.checkinBtnDone,
                    pressed && s.pressed,
                  ]}
                >
                  <Text style={[s.checkinText, checkinOk && s.checkinTextDone]}>
                    {checkinOk ? "Check-in feito" : "Estou segura"}
                  </Text>
                </Pressable>

                <Pressable onPress={openSOS} style={({ pressed }) => [s.sosBtn, pressed && s.pressed]}>
                  <SOSIcon size={48} />
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={s.agendaCard}>
            <Pressable
              onPress={() => setAgendaOpen((v) => !v)}
              style={({ pressed }) => [s.agendaHeader, pressed && s.pressed]}
            >
              <Text style={s.agendaTitle}>{agendaTitle}</Text>
              <Ionicons
                name={agendaOpen ? "chevron-up" : "chevron-down"}
                size={18}
                color={colors.sub}
              />
            </Pressable>

            {agendaOpen ? (
              others.length === 0 ? (
                <Text style={s.emptyText}>Nenhuma solicitação na agenda.</Text>
              ) : (
                others.map((item, index) => {
                  const isLast = index === others.length - 1;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => navigation.navigate(DIARISTA_STACK_ROUTES.DETALHE, { servico: item })}
                      style={({ pressed }) => [
                        s.agendaItem,
                        !isLast && s.agendaDivider,
                        pressed && s.pressed,
                      ]}
                    >
                      <View style={s.itemAvatar}>
                        <Ionicons name="person" size={18} color={colors.green} />
                      </View>

                      <View style={s.itemMain}>
                        <Text style={s.itemName} numberOfLines={1}>{item.cliente?.nome ?? "Cliente"}</Text>
                        <Text style={s.itemSub} numberOfLines={1}>
                          {item.bairro}, {item.cidade}
                        </Text>
                      </View>

                      <View style={s.timeBadge}>
                        <Ionicons name="checkmark" size={11} color={colors.greenDark} />
                        <Text style={s.timeText}>{item.turno === "MANHA" ? "07:00" : "20:30"}</Text>
                      </View>
                    </Pressable>
                  );
                })
              )
            ) : null}
          </View>

          <View style={s.badgesRow}>
            <DularBadge text={`Local ${coords ? "ativo" : "indisponível"}`} variant={coords ? "success" : "neutral"} />
            {securityLevel === "REFORCADO" ? <DularBadge text="Segurança reforçada" variant="warning" /> : null}
          </View>
        </CenterWrap>
      </ScrollView>
      <Modal visible={showPaywall} animationType="slide" presentationStyle="pageSheet">
        <PaywallScreen
          onClose={() => {
            setShowPaywall(false);
            refreshSubscription();
          }}
        />
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  header: {
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  logoWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 122,
    height: 64,
  },
  headerRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  greeting: {
    flex: 1,
    fontSize: 22,
    fontWeight: "900",
    color: colors.ink,
  },
  earningsWrap: {
    alignItems: "flex-end",
  },
  earningsValue: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.greenDark,
  },
  earningsLabel: {
    ...typography.sub,
  },
  pendingCard: {
    borderRadius: radius.xl,
    padding: 16,
    gap: 12,
    ...shadow.float,
  },
  pendingTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pendingTopLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  pendingPersonBadge: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  pendingTopText: {
    color: colors.card,
    fontSize: 14,
    fontWeight: "800",
  },
  pendingTitle: {
    color: colors.card,
    fontSize: 16,
    fontWeight: "800",
  },
  pendingScore: {
    backgroundColor: colors.card,
    borderColor: "rgba(255,255,255,0.45)",
  },
  pendingFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  pendingMetaRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  pendingMetaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.greenDark,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pendingMetaText: {
    color: colors.card,
    fontSize: 12,
    fontWeight: "700",
  },
  acceptBtn: {
    height: 40,
    minWidth: 98,
    borderRadius: radius.btn,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  acceptText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.greenDark,
  },
  rejectBtn: {
    marginTop: 4,
    alignSelf: "flex-start",
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  rejectText: {
    color: colors.card,
    fontSize: 12,
    fontWeight: "700",
  },
  dateRow: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  dateText: {
    ...typography.sub,
  },
  securityCard: {
    marginTop: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stroke,
    padding: 14,
    gap: spacing.sm,
    ...shadow.card,
  },
  securityTitle: {
    ...typography.h2,
  },
  securitySub: {
    ...typography.sub,
  },
  securityBtnRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  checkinBtn: {
    flex: 1,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.greenLight,
    borderWidth: 1,
    borderColor: colors.stroke,
    alignItems: "center",
    justifyContent: "center",
  },
  checkinBtnDone: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  checkinText: {
    color: colors.greenDark,
    fontSize: 12,
    fontWeight: "800",
  },
  checkinTextDone: {
    color: colors.card,
  },
  sosBtn: {
    width: 88,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  sosText: {
    color: colors.card,
    fontSize: 13,
    fontWeight: "800",
  },
  agendaCard: {
    marginTop: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stroke,
    overflow: "hidden",
    ...shadow.card,
  },
  agendaHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  agendaTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.ink,
  },
  agendaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  agendaDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.stroke,
  },
  itemAvatar: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.greenLight,
  },
  itemMain: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.ink,
  },
  itemSub: {
    ...typography.sub,
  },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.greenLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  timeText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.greenDark,
  },
  emptyText: {
    ...typography.sub,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  badgesRow: {
    marginTop: spacing.md,
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  pressed: {
    opacity: 0.75,
  },
  disabledBtn: {
    opacity: 0.6,
  },
});
