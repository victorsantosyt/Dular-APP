import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";

import { Screen } from "@/components/Screen";
import { AppIcon, BackCircleButton, type AppIconName } from "@/components/ui";
import { useAuth } from "@/stores/authStore";
import { useProfileTheme } from "@/hooks/useProfileTheme";
import type { ProfileTheme } from "@/theme/profileTheme";
import { getPublicScore, type PublicScore } from "@/api/safeScoreApi";
import { listarEventosSeguranca, protocoloFromId, type SafetyEvent } from "@/api/segurancaApi";
import { colors, radius, shadow, typography } from "@/theme/tokens";

/**
 * SafeScoreScreen — tela do SafeScore (compartilhada pelos 3 perfis).
 *
 * Mostra o status do SafeScore (faixa/nível/serviços/verificado) e uma seção de
 * "Acompanhamento de SOS". A identidade visual de cor segue o gênero do usuário
 * (rosa/verde/roxo) via useProfileTheme.
 */
export default function SafeScoreScreen() {
  const nav = useNavigation<any>();
  const currentUser = useAuth((s) => s.user);
  const theme = useProfileTheme(currentUser?.role);
  const s = useMemo(() => makeStyles(theme), [theme]);
  const voltarPerfil = () => nav.goBack();

  const [score, setScore] = useState<PublicScore | null>(null);
  const [lastSos, setLastSos] = useState<SafetyEvent | null>(null);
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

  // Acompanhamento de SOS: busca o último SOS real do backend ao focar a tela
  // (assim um SOS recém-acionado no SosFlow aparece ao voltar para cá).
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      listarEventosSeguranca("SOS_SILENT", 1)
        .then((eventos) => {
          if (alive) setLastSos(eventos[0] ?? null);
        })
        .catch(() => {
          // mantém o estado atual em caso de falha de rede
        });
      return () => {
        alive = false;
      };
    }, []),
  );

  const faixa = score?.faixa ?? "Em análise";

  const MetricBox = ({ icon, label, value }: { icon: AppIconName; label: string; value: string }) => (
    <View style={s.metricBox}>
      <View style={s.metricIcon}>
        <AppIcon name={icon} size={16} color={theme.primary} strokeWidth={2.3} />
      </View>
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={s.metricValue}>{value}</Text>
    </View>
  );

  return (
    <Screen
      title="SafeScore"
      rightAction={<BackCircleButton onPress={voltarPerfil} color={theme.icon} borderColor={theme.border} />}
      contentStyle={{ gap: 16 }}
    >
      {loading ? (
        <View style={s.loading}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : (
        <>
          <View style={s.hero}>
            <LinearGradient
              colors={theme.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.scoreCircle}
            >
              <AppIcon name="ShieldCheck" size={52} color={colors.white} strokeWidth={2.1} />
            </LinearGradient>
            <Text style={s.faixa}>{faixa}</Text>
            <Text style={s.heroSub}>
              Seu SafeScore reflete sua reputação e confiança na plataforma.
            </Text>
          </View>

          <View style={s.metricsRow}>
            <MetricBox icon="Award" label="Nível" value={score?.tier ?? "—"} />
            <MetricBox icon="CheckCircle" label="Serviços" value={String(score?.totalServicos ?? 0)} />
            <MetricBox icon="ShieldCheck" label="Verificado" value={score?.verificado ? "Sim" : "Não"} />
          </View>

          <Text style={s.sectionTitle}>Acompanhamento de SOS</Text>
          {lastSos ? (
            <View style={s.sosCard}>
              <View style={s.sosHeader}>
                <Text style={s.sosProtocolo}>{protocoloFromId(lastSos.id)}</Text>
                <View style={s.sosBadge}>
                  <Text style={s.sosBadgeText}>Em análise</Text>
                </View>
              </View>
              <View style={s.sosRow}>
                <Text style={s.sosRowLabel}>Tipo</Text>
                <Text style={s.sosRowValue}>{lastSos.meta?.tipo ?? "Incidente"}</Text>
              </View>
              <View style={s.sosRow}>
                <Text style={s.sosRowLabel}>Prioridade</Text>
                <Text style={s.sosRowValue}>{lastSos.meta?.prioridade ?? "—"}</Text>
              </View>
              <View style={s.sosRow}>
                <Text style={s.sosRowLabel}>Acionado em</Text>
                <Text style={s.sosRowValue}>
                  {new Date(lastSos.createdAt).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
              <Text style={s.sosNote}>
                Nossa equipe foi notificada e você receberá atualizações sobre o andamento.
              </Text>
            </View>
          ) : (
            <View style={s.emptyCard}>
              <View style={s.emptyIcon}>
                <AppIcon name="Bell" size={26} color={theme.primary} strokeWidth={2.2} />
              </View>
              <Text style={s.emptyTitle}>Nenhum SOS acionado</Text>
              <Text style={s.emptyText}>
                Quando você acionar o SOS, o status e o protocolo do atendimento aparecem aqui para acompanhamento.
              </Text>
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

function makeStyles(theme: ProfileTheme) {
  return StyleSheet.create({
    loading: { paddingTop: 48, alignItems: "center" },

    hero: { alignItems: "center", gap: 10, paddingTop: 8 },
    scoreCircle: {
      width: 116,
      height: 116,
      borderRadius: 58,
      alignItems: "center",
      justifyContent: "center",
      ...shadow.card,
    },
    faixa: { fontSize: 22, fontWeight: "800", color: colors.ink, marginTop: 2 },
    heroSub: {
      color: colors.sub,
      textAlign: "center",
      paddingHorizontal: 24,
      ...typography.bodySm,
      fontWeight: "500",
    },

    metricsRow: { flexDirection: "row", gap: 10 },
    metricBox: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.lg,
      padding: 14,
      gap: 6,
      backgroundColor: theme.backgroundSoft,
    },
    metricIcon: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primarySoft,
    },
    metricLabel: { color: colors.sub, fontSize: 12, fontWeight: "700" },
    metricValue: { color: colors.ink, fontSize: 16, fontWeight: "800" },

    sectionTitle: { fontSize: 15, fontWeight: "800", color: colors.ink, marginTop: 4 },

    sosCard: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.lg,
      padding: 16,
      gap: 10,
      backgroundColor: theme.backgroundSoft,
    },
    sosHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    sosProtocolo: { color: theme.textAccent, fontWeight: "800", fontSize: 15 },
    sosBadge: {
      backgroundColor: colors.warningSoft,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.pill,
    },
    sosBadgeText: { color: colors.warning, fontWeight: "800", fontSize: 12 },
    sosRow: { flexDirection: "row", justifyContent: "space-between" },
    sosRowLabel: { color: colors.sub, fontSize: 12, fontWeight: "500" },
    sosRowValue: { color: colors.ink, fontWeight: "700", fontSize: 12 },
    sosNote: { color: colors.sub, fontSize: 12, fontWeight: "500" },

    emptyCard: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.lg,
      padding: 20,
      gap: 8,
      alignItems: "center",
      backgroundColor: colors.card,
    },
    emptyIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primarySoft,
      marginBottom: 2,
    },
    emptyTitle: { color: colors.ink, fontWeight: "800", fontSize: 15 },
    emptyText: { color: colors.sub, fontSize: 12, fontWeight: "500", textAlign: "center" },
  });
}
