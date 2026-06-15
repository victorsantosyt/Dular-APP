import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "@/components/Screen";
import { useAuth } from "@/stores/authStore";
import { useProfileTheme } from "@/hooks/useProfileTheme";
import { useSosStore } from "@/stores/sosStore";
import { getPublicScore, type PublicScore } from "@/api/safeScoreApi";
import { colors } from "@/theme/tokens";

/**
 * SafeScoreScreen — tela do SafeScore (compartilhada pelos 3 perfis).
 *
 * Mostra o status do SafeScore (faixa/nível/serviços/verificado) e uma seção de
 * "Acompanhamento de SOS". O acompanhamento do SOS é ligado de fato na Etapa 3,
 * depois do fluxo SOS (Etapa 2) — por ora exibe o estado vazio.
 */
export default function SafeScoreScreen() {
  const nav = useNavigation<any>();
  const currentUser = useAuth((s) => s.user);
  const theme = useProfileTheme(currentUser?.role);
  const lastSos = useSosStore((s) => s.lastSos);
  const [score, setScore] = useState<PublicScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!currentUser?.id) {
        setLoading(false);
        return;
      }
      try {
        const data = await getPublicScore(currentUser.id);
        if (alive) setScore(data);
      } catch {
        // Mantém null — exibe faixa neutra "Em análise".
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [currentUser?.id]);

  const faixa = score?.faixa ?? "Em análise";

  const metricBox = (label: string, value: string) => (
    <View
      style={{
        flex: 1,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 14,
        padding: 14,
        gap: 4,
        backgroundColor: theme.backgroundSoft,
      }}
    >
      <Text style={{ color: colors.sub, fontSize: 12, fontWeight: "700" }}>{label}</Text>
      <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "800" }}>{value}</Text>
    </View>
  );

  return (
    <Screen
      title="SafeScore"
      rightAction={
        <Pressable onPress={() => nav.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
      }
      contentStyle={{ gap: 14 }}
    >
      {loading ? (
        <View style={{ paddingTop: 48, alignItems: "center" }}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : (
        <>
          <View style={{ alignItems: "center", gap: 10, paddingTop: 12 }}>
            <View
              style={{
                width: 110,
                height: 110,
                borderRadius: 55,
                backgroundColor: theme.backgroundSoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="shield-checkmark" size={58} color={theme.primary} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: "800", color: colors.ink }}>{faixa}</Text>
            <Text style={{ color: colors.sub, textAlign: "center", paddingHorizontal: 16 }}>
              Seu SafeScore reflete sua reputação e confiança na plataforma.
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            {metricBox("Nível", score?.tier ?? "—")}
            {metricBox("Serviços", String(score?.totalServicos ?? 0))}
            {metricBox("Verificado", score?.verificado ? "Sim" : "Não")}
          </View>

          <Text style={{ fontSize: 15, fontWeight: "800", color: colors.ink, marginTop: 6 }}>
            Acompanhamento de SOS
          </Text>
          {lastSos ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: theme.border,
                borderRadius: 14,
                padding: 16,
                gap: 10,
                backgroundColor: theme.backgroundSoft,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: theme.textAccent, fontWeight: "800", fontSize: 15 }}>{lastSos.protocolo}</Text>
                <View style={{ backgroundColor: colors.warningSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                  <Text style={{ color: colors.warning, fontWeight: "800", fontSize: 12 }}>Em análise</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.sub, fontSize: 12 }}>Tipo</Text>
                <Text style={{ color: colors.ink, fontWeight: "700", fontSize: 12 }}>{lastSos.tipoLabel}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.sub, fontSize: 12 }}>Acionado em</Text>
                <Text style={{ color: colors.ink, fontWeight: "700", fontSize: 12 }}>
                  {new Date(lastSos.criadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
              <Text style={{ color: colors.sub, fontSize: 12 }}>
                Nossa equipe foi notificada e você receberá atualizações sobre o andamento.
              </Text>
            </View>
          ) : (
            <View
              style={{
                borderWidth: 1,
                borderColor: theme.border,
                borderRadius: 14,
                padding: 16,
                gap: 8,
                alignItems: "center",
                backgroundColor: "rgba(255,255,255,0.92)",
              }}
            >
              <Ionicons name="notifications-outline" size={28} color={theme.primary} />
              <Text style={{ color: colors.ink, fontWeight: "700" }}>Nenhum SOS acionado</Text>
              <Text style={{ color: colors.sub, fontSize: 12, textAlign: "center" }}>
                Quando você acionar o SOS, o status e o protocolo do atendimento aparecem aqui para acompanhamento.
              </Text>
            </View>
          )}
        </>
      )}
    </Screen>
  );
}
