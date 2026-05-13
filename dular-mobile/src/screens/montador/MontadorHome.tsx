import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppIcon, DCard, DEmptyState, DErrorState, DLoadingState, DScreen } from "@/components/ui";
import { acionarSosMontador } from "@/api/montadorApi";
import { useMontadorServicos } from "@/hooks/useMontadorServicos";
import { useProfileTheme } from "@/hooks/useProfileTheme";
import { useAuth } from "@/stores/authStore";
import type { MontadorTabParamList } from "@/navigation/MontadorNavigator";
import { colors, radius, shadows, typography } from "@/theme";
import {
  firstName,
  formatDateTime,
  formatMoneyFromCents,
  labelServico,
  localResumo,
  upperStatus,
} from "./montadorUtils";

type Navigation = BottomTabNavigationProp<MontadorTabParamList>;

export function MontadorHome() {
  const navigation = useNavigation<Navigation>();
  const user = useAuth((state) => state.user);
  const profileTheme = useProfileTheme("MONTADOR");
  const { servicos, agenda, pendentes, loading, error, refetch } = useMontadorServicos();
  const [online, setOnline] = useState(true);
  const [sosLoading, setSosLoading] = useState(false);

  const displayName = firstName(user?.nome);
  const proximoServico = agenda.find((item) => !["FINALIZADO", "CONCLUIDO"].includes(upperStatus(item.status)));
  const concluIds = useMemo(
    () => servicos.filter((item) => ["FINALIZADO", "CONCLUIDO"].includes(upperStatus(item.status))),
    [servicos],
  );
  const ganhosTotais = useMemo(
    () => concluIds.reduce((sum, item) => sum + (item.precoFinal ?? item.valorEstimado ?? 0), 0),
    [concluIds],
  );

  const perfilPendente = user?.verificacao?.status && user.verificacao.status !== "APROVADO";

  const carregarResumoMontador = refetch;
  const alternarDisponibilidade = () => setOnline((current) => !current);
  const abrirDetalheServico = (servicoId: string) => navigation.navigate("MontadorDetalheServico", { servicoId });
  const acionarSOS = async () => {
    const servicoId = proximoServico?.id ?? agenda[0]?.id;
    if (!servicoId) {
      Alert.alert("SOS indisponível", "O SOS fica disponível quando houver um serviço aceito ou em andamento.");
      return;
    }
    try {
      setSosLoading(true);
      await acionarSosMontador(servicoId);
      Alert.alert("SOS acionado", "A equipe de segurança foi notificada.");
    } catch {
      Alert.alert("Falha ao acionar SOS", "Não foi possível registrar o SOS no momento.");
    } finally {
      setSosLoading(false);
    }
  };

  return (
    <DScreen
      scroll
      withBottomPadding
      refreshing={loading}
      refreshTintColor={profileTheme.primary}
      onRefresh={() => {
        carregarResumoMontador();
      }}
      backgroundColor={profileTheme.background}
      contentContainerStyle={styles.scroll}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Olá, {displayName}</Text>
          <Text style={styles.subtitle}>Sua rotina profissional no Dular</Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate("MontadorNotificacoes")}
          hitSlop={12}
          style={[styles.notificationButton, { borderColor: profileTheme.border }]}
        >
          <AppIcon name="Bell" size={20} color={profileTheme.icon} strokeWidth={2.2} />
          {pendentes.length > 0 ? <View style={[styles.dot, { backgroundColor: profileTheme.primary }]} /> : null}
        </Pressable>
      </View>

      {perfilPendente ? (
        <View style={[styles.warningCard, { borderColor: profileTheme.border, backgroundColor: profileTheme.primarySoft }]}>
          <AppIcon name="ShieldCheck" size={18} color={profileTheme.primary} strokeWidth={2.2} />
          <Text style={[styles.warningText, { color: profileTheme.textAccent }]}>
            Perfil incompleto ou documentos pendentes. Complete sua verificação para receber mais oportunidades.
          </Text>
        </View>
      ) : null}

      <LinearGradient colors={profileTheme.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroContent}>
          <View style={styles.heroTextBlock}>
            <Text style={styles.heroKicker}>Ganhos totais</Text>
            <Text style={styles.heroTitle}>{formatMoneyFromCents(ganhosTotais)}</Text>
            <Text style={styles.heroSub}>
              {concluIds.length > 0
                ? `${concluIds.length} serviço(s) finalizado(s) no Dular.`
                : "Seus ganhos aparecerão após finalizar serviços."}
            </Text>
          </View>
          <View style={styles.walletIconWrap}>
            <AppIcon name="Wallet" size={34} color={colors.white} strokeWidth={2.1} />
          </View>
        </View>
        <Pressable onPress={alternarDisponibilidade} style={styles.availabilityButton}>
          <Text style={styles.availabilityText}>
            {online ? "Online - Ficar indisponível" : "Indisponível - Ficar online"}
          </Text>
        </Pressable>
      </LinearGradient>

      <DCard style={styles.nextCard} onPress={proximoServico ? () => abrirDetalheServico(proximoServico.id) : undefined}>
        <View style={styles.nextHeader}>
          <Text style={styles.cardTitle}>Próximo serviço</Text>
          <AppIcon name="CalendarCheck" size={22} color={profileTheme.primary} strokeWidth={2.2} />
        </View>
        {loading ? (
          <DLoadingState text="Carregando serviço" color={profileTheme.primary} />
        ) : error ? (
          <DErrorState message={error} onRetry={refetch} />
        ) : proximoServico ? (
          <View style={styles.nextContent}>
            <Text style={styles.nextTitle}>{labelServico(proximoServico)}</Text>
            <Text style={styles.nextSub}>{formatDateTime(proximoServico)}</Text>
            <Text style={styles.nextSub}>{localResumo(proximoServico, true)}</Text>
          </View>
        ) : (
          <DEmptyState
            icon="Calendar"
            title="Sem serviço agendado"
            subtitle="Quando uma solicitação for aceita, ela aparecerá aqui."
            accentColor={profileTheme.primary}
            softBg={profileTheme.primarySoft}
          />
        )}
      </DCard>

      <View style={styles.securityGrid}>
        <View style={[styles.securityCard, { borderColor: profileTheme.border }]}>
          <AppIcon name="ShieldCheck" size={22} color={profileTheme.primary} />
          <Text style={styles.securityTitle}>Verificação</Text>
          <Text style={styles.securitySub}>{perfilPendente ? "Pendente" : "Em dia"}</Text>
        </View>
        <View style={[styles.securityCard, { borderColor: profileTheme.border }]}>
          <AppIcon name="Award" size={22} color={profileTheme.primary} />
          <Text style={styles.securityTitle}>SafeScore</Text>
          <Text style={styles.securitySub}>Proteção ativa</Text>
        </View>
        <Pressable
          onPress={acionarSOS}
          disabled={sosLoading}
          style={({ pressed }) => [styles.sosCard, pressed && styles.pressed]}
        >
          <Text style={styles.sosTitle}>{sosLoading ? "Enviando" : "SOS"}</Text>
          <Text style={styles.sosSub}>Segurança</Text>
        </Pressable>
      </View>
    </DScreen>
  );
}

export default MontadorHome;

const styles = StyleSheet.create({
  scroll: {
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  greeting: {
    color: colors.textPrimary,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "700",
    letterSpacing: 0,
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  notificationButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surface,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    position: "absolute",
    right: 9,
    top: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  warningCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 12,
  },
  warningText: {
    flex: 1,
    ...typography.caption,
    fontWeight: "700",
  },
  hero: {
    borderRadius: radius.xl,
    padding: 18,
    minHeight: 144,
    justifyContent: "space-between",
    ...shadows.primaryButton,
  },
  heroContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  heroTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  heroKicker: {
    ...typography.caption,
    color: colors.whiteAlpha80,
    fontWeight: "700",
  },
  heroTitle: {
    marginTop: 6,
    fontSize: 30,
    lineHeight: 36,
    color: colors.white,
    fontWeight: "700",
  },
  heroSub: {
    ...typography.bodySm,
    color: colors.whiteAlpha85,
    marginTop: 4,
  },
  walletIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.whiteAlpha20,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  availabilityButton: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.whiteAlpha20,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  availabilityText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: "700",
  },
  nextCard: {
    gap: 12,
  },
  nextHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  nextContent: {
    gap: 5,
  },
  nextTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  nextSub: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  securityGrid: {
    flexDirection: "row",
    gap: 10,
  },
  securityCard: {
    flex: 1,
    minHeight: 96,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 12,
    justifyContent: "center",
  },
  securityTitle: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: "700",
    marginTop: 8,
  },
  securitySub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 3,
    fontWeight: "500",
  },
  sosCard: {
    flex: 1,
    minHeight: 96,
    borderRadius: radius.lg,
    backgroundColor: colors.danger,
    padding: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  sosTitle: {
    color: colors.white,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "700",
  },
  sosSub: {
    color: colors.whiteAlpha80,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },
  pressed: {
    opacity: 0.75,
  },
});
