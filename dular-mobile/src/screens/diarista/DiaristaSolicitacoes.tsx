import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { View, Text, Pressable, Alert, RefreshControl, Image, ScrollView, Animated, Easing, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../../lib/api";
import { MinhasResponse, Servico } from "../../types/servico";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { logoSource } from "../../lib/logoSource";
import { dularColors } from "../../theme/dular";
import { DularBadge } from "../../components/DularBadge";
import { CenterWrap, useDularContainerWidth } from "../../ui/Layout";
import { requestLocationWithAddress, startLocationWatcher, type LocationUpdate } from "../../lib/location";

export default function DiaristaSolicitacoes({ navigation }: any) {
  const [items, setItems] = useState<Servico[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [pendenteOpen, setPendenteOpen] = useState(true);
  const [aceitando, setAceitando] = useState(false);
  const [checkinOk, setCheckinOk] = useState(false);
  const cw = useDularContainerWidth();
  const LOGO_W = 190;
  const LOGO_H = 105;
  const HEADER_BG = "#ECF7F1";
  const HEADER_H = 190;
  const cardAnim = useMemo(() => new Animated.Value(0), []);
  const scrollRef = useRef<ScrollView>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const locationSub = useRef<Location.LocationSubscription | null>(null);

  const onLocationUpdate = useCallback((data: LocationUpdate) => {
    const { latitude, longitude } = data.coords;
    setCoords({ lat: latitude, lng: longitude });
  }, []);

  async function load() {
    try {
      setRefreshing(true);
      const res = await api.get<MinhasResponse>("/api/servicos/minhas");
      setItems(res.data.servicos || []);
    } catch (e: any) {
      Alert.alert("Erro", e?.response?.data?.error ?? e?.message ?? "Falha ao carregar");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
    Animated.timing(cardAnim, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      (async () => {
        try {
          locationSub.current = await startLocationWatcher(onLocationUpdate);
        } catch {
          // se negar permissão, segue sem localização
        }
      })();
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      });
      return () => {
        locationSub.current?.remove();
        locationSub.current = null;
      };
    }, [onLocationUpdate])
  );

  const pending = useMemo(() => items.find((s) => s.status === "SOLICITADO"), [items]);
  const others = useMemo(() => items.filter((s) => !(pending && s.id === pending.id)), [items, pending]);
  const securityLevel = pending?.securityLevel ?? "NORMAL";
  const clienteVerificacao = pending?.clienteVerificacao ?? "NAO_ENVIADO";

  // TODO: trocar por origem real do usuário autenticado (ex.: contexto de auth)
  const displayName = useMemo(() => {
    const raw =
      pending?.diarista?.nome ||
      pending?.diarista?.name ||
      pending?.diarista?.fullName ||
      "";
    return raw.trim() || "Diarista";
  }, [pending]);

  async function onAceitar() {
    if (!pending?.id) return;
    try {
      setAceitando(true);
      await api.post(`/api/servicos/${pending.id}/aceitar`);
      await load();
    } catch (e: any) {
      Alert.alert("Erro", e?.response?.data?.error ?? e?.message ?? "Falha ao aceitar");
    } finally {
      setAceitando(false);
    }
  }

  async function onRecusar() {
    if (!pending?.id) return;
    try {
      await api.post(`/api/servicos/${pending.id}/recusar`);
      await load();
    } catch (e: any) {
      Alert.alert("Erro", e?.response?.data?.error ?? e?.message ?? "Falha ao recusar");
    }
  }

  const openSOS = async () => {
    const phone = "5565999990000";
    const msg = encodeURIComponent("Preciso de ajuda em um atendimento (Dular).");
    const url = `https://wa.me/${phone}?text=${msg}`;
    const ok = await Linking.canOpenURL(url);
    if (!ok) return Alert.alert("SOS", "Não foi possível abrir o WhatsApp.");
    Linking.openURL(url);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: HEADER_BG }} edges={["top", "left", "right"]}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: HEADER_BG }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustContentInsets
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} progressViewOffset={HEADER_H} />
        }
      >
        {/* Header */}
        <View
          style={{
            backgroundColor: HEADER_BG,
            paddingTop: 12,
            paddingBottom: 8,
            alignItems: "center",
          }}
        >
          <Image
            source={logoSource}
            style={{
              width: LOGO_W,
              height: LOGO_H,
              resizeMode: "contain",
              alignSelf: "center",
              marginBottom: 10,
            }}
          />
          <View style={{ paddingHorizontal: 22, width: "100%" }}>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 26,
                fontWeight: "700",
                color: "#1F2937",
                textAlign: "center",
                paddingHorizontal: 6,
              }}
            >
              Olá, {displayName}
            </Text>
          </View>
          <View style={{ height: 10 }} />
          <View style={{ paddingHorizontal: 22, width: "100%", flexDirection: "row", justifyContent: "center", gap: 8 }}>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: clienteVerificacao === "APROVADO" ? "#DCFCE7" : "#DBEAFE",
              }}
            >
              <Text
                style={{
                  color: clienteVerificacao === "APROVADO" ? "#166534" : "#1D4ED8",
                  fontWeight: "800",
                  fontSize: 12,
                }}
              >
                {clienteVerificacao === "APROVADO" ? "Cliente verificado" : "Verificação pendente"}
              </Text>
            </View>
            {securityLevel === "REFORCADO" && (
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: "#FEF3C7",
                }}
              >
                <Text style={{ color: "#B45309", fontWeight: "800", fontSize: 12 }}>Segurança reforçada</Text>
              </View>
            )}
          </View>
        </View>

        <CenterWrap mt={6}>
          {/* Card teal */}
          <Animated.View
            style={{
              borderRadius: 20,
              padding: 18,
              backgroundColor: "#2F8A94",
              justifyContent: "space-between",
              shadowColor: "#000",
              shadowOpacity: 0.12,
              shadowRadius: 22,
              shadowOffset: { width: 0, height: 16 },
              elevation: 8,
              opacity: cardAnim,
              transform: [
                {
                  translateY: cardAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
              ],
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: "rgba(255,255,255,0.12)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="time-outline" size={18} color="rgba(255,255,255,0.85)" />
                </View>
                <Text style={{ color: "#EAFBFA", fontWeight: "700", fontSize: 16 }}>
                  {pending ? "1 Pendente" : "Sem pendências"}
                </Text>
              </View>
              <Pressable onPress={() => setPendenteOpen((v) => !v)} hitSlop={10}>
                <Ionicons
                  name={pendenteOpen ? "chevron-up" : "chevron-down"}
                  size={22}
                  color="rgba(255,255,255,0.7)"
                />
              </Pressable>
            </View>

            {pendenteOpen && (
              <>
                <Text style={{ color: "rgba(255,255,255,0.92)", fontSize: 18, fontWeight: "600" }}>
                  {pending ? "Faxina leve agendada" : "Aguardando novas solicitações"}
                </Text>

                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ color: "rgba(255,255,255,0.70)", fontSize: 14 }}>
                    {pending ? "25%  ·  2H" : "Fique online e aguarde"}
                  </Text>
                  {pending ? (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {securityLevel === "REFORCADO" && (
                        <Pressable
                          onPress={onRecusar}
                          disabled={aceitando}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            borderRadius: 14,
                            backgroundColor: "#FEE2E2",
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: aceitando ? 0.7 : 1,
                          }}
                        >
                          <Text style={{ color: "#B91C1C", fontWeight: "700", fontSize: 14 }}>
                            Recusar
                          </Text>
                        </Pressable>
                      )}
                      <Pressable
                        onPress={onAceitar}
                        disabled={aceitando}
                        style={{
                          paddingHorizontal: 18,
                          paddingVertical: 10,
                          borderRadius: 14,
                          backgroundColor: "#8FD3A8",
                          alignItems: "center",
                          justifyContent: "center",
                          opacity: aceitando ? 0.7 : 1,
                        }}
                      >
                        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                          {aceitando ? "..." : "Aceitar"}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </>
            )}
          </Animated.View>

          {/* Label de dia */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
            <Ionicons name="calendar-outline" size={18} color="#6FAE9F" />
            <Text style={{ fontSize: 16, fontWeight: "600", color: dularColors.text }}>Terça-feira, 10 de maio</Text>
          </View>

          {/* Segurança rápida */}
          {pending && (
            <View
              style={{
                marginTop: 10,
                width: "100%",
                borderRadius: 16,
                backgroundColor: "rgba(255,255,255,0.92)",
                borderWidth: 1,
                borderColor: "#EEF2F4",
                padding: 12,
                gap: 8,
              }}
            >
              <Text style={{ fontWeight: "800", color: dularColors.text }}>Segurança</Text>
              <Text style={{ color: dularColors.muted, fontSize: 12 }}>
                Use o SOS se se sentir em risco. O check-in é opcional e não penaliza.
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={() => setCheckinOk(true)}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: "#EAF6F0",
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: dularColors.border,
                  }}
                >
                  <Text style={{ color: dularColors.success, fontWeight: "800" }}>
                    {checkinOk ? "Check-in feito" : "Estou segura"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={openSOS}
                  style={{
                    width: 120,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: "#FEE2E2",
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: "#FECACA",
                  }}
                >
                  <Text style={{ color: "#B91C1C", fontWeight: "800" }}>SOS</Text>
                </Pressable>
              </View>
              <Pressable
                onPress={() => navigation.navigate("ReportIncident", { serviceId: pending.id, reportedUserId: pending.cliente.id })}
                style={{
                  marginTop: 4,
                  height: 44,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                  backgroundColor: "#fff",
                }}
              >
                <Text style={{ color: "#111827", fontWeight: "700" }}>Reportar incidente</Text>
              </Pressable>
            </View>
          )}

          {/* Card lista */}
          <View
            style={{
              marginTop: 8,
              borderRadius: 18,
              backgroundColor: "rgba(255,255,255,0.92)",
              borderWidth: 1,
              borderColor: dularColors.border,
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 12 },
              elevation: 6,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 16,
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: "#EEF2F4",
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "700", color: dularColors.text }}>Terça-feira, 14 de maio</Text>
              <Ionicons name="chevron-down" size={18} color="#A7B3BE" />
            </View>

            {others.length === 0 ? (
              <Text style={{ color: "#9AA6B2", padding: 16, fontSize: 16 }}>Nenhuma solicitação.</Text>
            ) : (
              others.map((item, idx) => {
                const last = idx === others.length - 1;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => navigation.navigate("DiaristaDetalhe", { servico: item })}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      borderBottomWidth: last ? 0 : 1,
                      borderBottomColor: "#EEF2F4",
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: "#E7F4EF",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="person-outline" size={22} color={dularColors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: dularColors.text }}>
                        {item.cliente?.nome ?? "Cliente"}
                      </Text>
                      <View style={{ flexDirection: "row", gap: 6, marginTop: 2, alignItems: "center" }}>
                        <DularBadge
                          text={item.clienteVerificacao === "APROVADO" ? "Verificado" : "Verificação pendente"}
                          bg={item.clienteVerificacao === "APROVADO" ? "#DCFCE7" : "#DBEAFE"}
                          color={item.clienteVerificacao === "APROVADO" ? "#166534" : "#1D4ED8"}
                        />
                        {item.securityLevel === "REFORCADO" && <DularBadge text="Segurança" bg="#FEF3C7" color="#B45309" />}
                      </View>
                    </View>
                    <DularBadge
                      text={item.turno === "MANHA" ? "7:00" : "20:30"}
                      bg="#EAF6F0"
                      color={dularColors.success}
                      icon={<Ionicons name="checkmark-circle" size={16} color={dularColors.success} />}
                      style={{ height: 28 }}
                    />
                  </Pressable>
                );
              })
            )}
          </View>
        </CenterWrap>
      </ScrollView>
    </SafeAreaView>
  );
}
