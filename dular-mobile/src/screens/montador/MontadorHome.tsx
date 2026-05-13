import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppIcon, DCard, DEmptyState, DErrorState, DLoadingState, DScreen, DSectionHeader } from "@/components/ui";
import { acionarSosMontador, type MontadorServico } from "@/api/montadorApi";
import { useMontadorServicos } from "@/hooks/useMontadorServicos";
import { useProfileTheme } from "@/hooks/useProfileTheme";
import { useAuth } from "@/stores/authStore";
import type { MontadorTabParamList } from "@/navigation/MontadorNavigator";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import {
  firstName,
  formatDateTime,
  formatMoneyFromCents,
  isToday,
  labelServico,
  localResumo,
  statusLabel,
  upperStatus,
} from "./montadorUtils";

type Navigation = BottomTabNavigationProp<MontadorTabParamList>;

function MetricCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={[styles.metricValue, { color: accent }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function ServicoMiniCard({
  servico,
  accent,
  soft,
  onPress,
}: {
  servico: MontadorServico;
  accent: string;
  soft: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.miniCard, pressed && styles.pressed]}>
      <View style={[styles.miniIcon, { backgroundColor: soft }]}>
        <AppIcon name="Wrench" size={18} color={accent} strokeWidth={2.2} />
      </View>
      <View style={styles.miniText}>
        <Text style={styles.miniTitle} numberOfLines={1}>{labelServico(servico)}</Text>
        <Text style={styles.miniSub} numberOfLines={1}>{formatDateTime(servico)}</Text>
        <Text style={styles.miniSub} numberOfLines={1}>{localResumo(servico)}</Text>
      </View>
      <View style={[styles.statusPill, { backgroundColor: soft, borderColor: accent }]}>
        <Text style={[styles.statusText, { color: accent }]}>{statusLabel(servico.status)}</Text>
      </View>
    </Pressable>
  );
}

export function MontadorHome() {
  const navigation = useNavigation<Navigation>();
  const user = useAuth((state) => state.user);
  const profileTheme = useProfileTheme("MONTADOR");
  const { servicos, agenda, pendentes, loading, error, refetch } = useMontadorServicos();
  const [online, setOnline] = useState(true);
  const [sosLoading, setSosLoading] = useState(false);

  const displayName = firstName(user?.nome);
  const hoje = useMemo(() => agenda.filter(isToday), [agenda]);
  const proximoServico = agenda.find((item) => !["FINALIZADO", "CONCLUIDO"].includes(upperStatus(item.status)));
  const concluIds = useMemo(
    () => servicos.filter((item) => ["FINALIZADO", "CONCLUIDO"].includes(upperStatus(item.status))),
    [servicos],
  );
  const ganhosMes = useMemo(() => {
    const now = new Date();
    return concluIds
      .filter((item) => {
        const date = item.data ? new Date(item.data) : null;
        return date && !Number.isNaN(date.getTime()) && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      })
      .reduce((sum, item) => sum + (item.precoFinal ?? item.valorEstimado ?? 0), 0);
  }, [concluIds]);

  const perfilPendente = user?.verificacao?.status && user.verificacao.status !== "APROVADO";

  const carregarResumoMontador = refetch;
  const carregarServicosDeHoje = refetch;
  const carregarSolicitacoesPendentes = refetch;
  const alternarDisponibilidade = () => setOnline((current) => !current);
  const abrirDetalheServico = (servicoId: string) => navigation.navigate("MontadorDetalheServico", { servicoId });
  const abrirDetalheSolicitacao = (servicoId: string) => navigation.navigate("MontadorDetalheSolicitacao", { servicoId });
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
      onRefresh={() => {
        carregarResumoMontador();
        carregarServicosDeHoje();
        carregarSolicitacoesPendentes();
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
          onPress={() => navigation.navigate("MontadorMensagens")}
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
        <View>
          <Text style={styles.heroKicker}>Status profissional</Text>
          <Text style={styles.heroTitle}>{online ? "Online" : "Indisponível"}</Text>
          <Text style={styles.heroSub}>
            {online ? "Você pode receber novas solicitações." : "Você não aparecerá para novas solicitações."}
          </Text>
        </View>
        <Pressable onPress={alternarDisponibilidade} style={styles.availabilityButton}>
          <Text style={styles.availabilityText}>{online ? "Ficar indisponível" : "Ficar online"}</Text>
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

      <View style={styles.metricsGrid}>
        <MetricCard label="Ganhos do mês" value={formatMoneyFromCents(ganhosMes)} accent={profileTheme.primary} />
        <MetricCard label="Concluídos" value={String(concluIds.length)} accent={profileTheme.primary} />
        <MetricCard label="Avaliação média" value="--" accent={profileTheme.primary} />
        <MetricCard label="Pendentes" value={String(pendentes.length)} accent={profileTheme.primary} />
      </View>

      <View style={styles.section}>
        <DSectionHeader title="Hoje" />
        {loading ? (
          <DLoadingState text="Carregando agenda" color={profileTheme.primary} />
        ) : hoje.length > 0 ? (
          hoje.slice(0, 3).map((item) => (
            <ServicoMiniCard
              key={item.id}
              servico={item}
              accent={profileTheme.primary}
              soft={profileTheme.primarySoft}
              onPress={() => abrirDetalheServico(item.id)}
            />
          ))
        ) : (
          <DEmptyState
            icon="Clock"
            title="Nenhum serviço hoje"
            subtitle="Sua agenda do dia está livre."
            accentColor={profileTheme.primary}
            softBg={profileTheme.primarySoft}
          />
        )}
      </View>

      <View style={styles.section}>
        <DSectionHeader
          title="Novas solicitações"
          action={pendentes.length > 0 ? "Ver todas" : undefined}
          onAction={() => navigation.navigate("MontadorSolicitacoes")}
        />
        {loading ? (
          <DLoadingState text="Carregando solicitações" color={profileTheme.primary} />
        ) : pendentes.length > 0 ? (
          pendentes.slice(0, 3).map((item) => (
            <ServicoMiniCard
              key={item.id}
              servico={item}
              accent={profileTheme.primary}
              soft={profileTheme.primarySoft}
              onPress={() => abrirDetalheSolicitacao(item.id)}
            />
          ))
        ) : (
          <DEmptyState
            icon="BriefcaseBusiness"
            title="Sem novas solicitações"
            subtitle="Novos pedidos aparecerão nesta área."
            accentColor={profileTheme.primary}
            softBg={profileTheme.primarySoft}
          />
        )}
      </View>

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
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: "700",
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
  heroKicker: {
    ...typography.caption,
    color: colors.whiteAlpha80,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  heroTitle: {
    marginTop: 6,
    fontSize: 32,
    lineHeight: 38,
    color: colors.white,
    fontWeight: "800",
  },
  heroSub: {
    ...typography.bodySm,
    color: colors.whiteAlpha85,
    marginTop: 4,
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
    fontWeight: "800",
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
    ...typography.title,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  nextContent: {
    gap: 5,
  },
  nextTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: "800",
  },
  nextSub: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricCard: {
    width: "48%",
    minHeight: 86,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    justifyContent: "center",
    ...shadows.soft,
  },
  metricValue: {
    fontSize: 19,
    fontWeight: "800",
  },
  metricLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 6,
    fontWeight: "600",
  },
  section: {
    gap: 10,
  },
  miniCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
  },
  miniIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  miniText: {
    flex: 1,
    minWidth: 0,
  },
  miniTitle: {
    ...typography.bodySmMedium,
    color: colors.textPrimary,
    fontWeight: "800",
  },
  miniSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusPill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800",
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
    fontWeight: "800",
    marginTop: 8,
  },
  securitySub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 3,
    fontWeight: "600",
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
    fontWeight: "900",
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
