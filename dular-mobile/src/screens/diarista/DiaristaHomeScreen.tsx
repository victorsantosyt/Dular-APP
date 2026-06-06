import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppIcon, type AppIconName, DAvatar, DBadge, DCard, DScreen, DSectionHeader } from "@/components/ui";
import { Wallet3DIcon } from "@/assets/icons";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import { useAuth } from "@/stores/authStore";
import { useGenderTheme } from "@/hooks/useProfileTheme";
import type { ProfileTheme } from "@/theme/profileTheme";
import type { DiaristaTabParamList } from "@/navigation/DiaristaNavigator";
import { getMyRestrictions, type UserRestriction } from "@/api/safeScoreApi";
import { acionarSosDiarista } from "@/api/diaristaApi";
import { useAgendamentosDiarista, type AgendamentoDiarista, type StatusDiarista } from "@/hooks/useAgendamentosDiarista";
import { useMensagens } from "@/hooks/useMensagens";

type Navigation = BottomTabNavigationProp<DiaristaTabParamList>;
type BadgeType = "default" | "success" | "warning" | "error" | "info" | "accent";
type QuickActionId = "agendamentos" | "carteira" | "mensagens" | "suporte";

const QUICK_ACTIONS: { id: QuickActionId; icon: AppIconName; label: string }[] = [
  { id: "agendamentos", icon: "Calendar", label: "Agendamentos" },
  { id: "carteira", icon: "Wallet", label: "Meus ganhos" },
  { id: "mensagens", icon: "MessageCircle", label: "Mensagens" },
  { id: "suporte", icon: "HelpCircle", label: "Suporte" },
];

function TopBar({
  firstName,
  avatarUrl,
  unreadMessages,
  theme,
  onProfilePress,
  onBellPress,
}: {
  firstName: string;
  avatarUrl?: string;
  unreadMessages: number;
  theme: ProfileTheme;
  onProfilePress: () => void;
  onBellPress: () => void;
}) {
  const badgeLabel = unreadMessages > 9 ? "9+" : String(unreadMessages);

  return (
    <View style={styles.topBar}>
      {/* avatar (com ring temático) */}
      <Pressable hitSlop={8} onPress={onProfilePress} style={[styles.avatarRing, { borderColor: theme.primary }]}>
        <DAvatar size="md" uri={avatarUrl} initials={firstName.slice(0, 2)} online />
      </Pressable>

      {/* nome do usuário */}
      <View style={styles.topGreeting}>
        <Text style={styles.greeting} numberOfLines={1}>Olá, {firstName}!</Text>
        <Text style={styles.greetingSub} numberOfLines={1}>Que bom te ver por aqui!</Text>
      </View>

      {/* sino (mantém a posição à direita) */}
      <Pressable hitSlop={8} onPress={onBellPress} style={[styles.bellButton, { borderColor: theme.border }]}>
        <AppIcon name="Bell" size={20} color={theme.icon} strokeWidth={2.2} />
        {unreadMessages > 0 ? (
          <View style={[styles.bellBadge, { backgroundColor: theme.primary }]}>
            <Text style={styles.bellBadgeText}>{badgeLabel}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

function getAgendaBadge(status: StatusDiarista): { label: string; type: BadgeType } {
  if (status === "confirmado") return { label: "Confirmado", type: "success" };
  if (status === "andamento") return { label: "Em andamento", type: "info" };
  if (status === "finalizado") return { label: "Finalizado", type: "default" };
  if (status === "cancelado") return { label: "Cancelado", type: "error" };
  return { label: "Pendente", type: "warning" };
}

function AgendamentoItem({
  agendamento,
  accentColor,
  softBg,
}: {
  agendamento: AgendamentoDiarista;
  accentColor: string;
  softBg: string;
}) {
  const badge = getAgendaBadge(agendamento.status);

  return (
    <View style={styles.appointmentRow}>
      <View style={[styles.timeBox, { backgroundColor: softBg }]}>
        <AppIcon name="Clock" size={18} color={accentColor} />
        <Text style={[styles.timeText, { color: accentColor }]}>{agendamento.hora}</Text>
      </View>
      <View style={styles.appointmentText}>
        <Text style={styles.appointmentFamily} numberOfLines={1}>{agendamento.nomeCliente}</Text>
        <Text style={styles.appointmentType} numberOfLines={1}>{agendamento.servico}</Text>
        <View style={styles.appointmentLocationRow}>
          <AppIcon name="MapPin" size={12} color={colors.textSecondary} />
          <Text style={styles.appointmentLocation} numberOfLines={1}>{agendamento.localizacao}</Text>
        </View>
      </View>
      <DBadge type={badge.type} label={badge.label} />
    </View>
  );
}

function AcaoRapidaBtn({
  icon,
  label,
  accentColor,
  softBg,
  onPress,
}: {
  icon: AppIconName;
  label: string;
  accentColor: string;
  softBg: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}>
      <View style={[styles.quickIconBox, { backgroundColor: softBg }]}>
        <AppIcon name={icon} size={22} color={accentColor} strokeWidth={2.1} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

export function DiaristaHomeScreen() {
  const navigation = useNavigation<Navigation>();
  const user = useAuth((state) => state.user);
  const firstName = (user?.nome || "Diarista").trim().split(/\s+/)[0];
  const profileTheme = useGenderTheme("DIARISTA");
  const { agendamentos, loading: agendamentosLoading, error: agendamentosError, refetch } = useAgendamentosDiarista();
  const { rooms } = useMensagens();

  const [restrictions, setRestrictions] = useState<UserRestriction[]>([]);
  const [sosLoading, setSosLoading] = useState(false);
  const nextAgendamento = agendamentos[0];
  const unreadMessages = useMemo(
    () => rooms.reduce((total, room) => total + Math.max(0, Number(room.naoLidas) || 0), 0),
    [rooms],
  );
  const perfilPendente = !!user?.verificacao?.status && user.verificacao.status !== "APROVADO";

  const loadRestrictions = useCallback(() => {
    getMyRestrictions()
      .then(setRestrictions)
      .catch(() => []);
  }, []);

  useEffect(() => {
    loadRestrictions();
  }, [loadRestrictions]);

  const handleRefresh = useCallback(() => {
    refetch();
    loadRestrictions();
  }, [refetch, loadRestrictions]);

  const handleQuickAction = useCallback((action: QuickActionId) => {
    if (action === "agendamentos") navigation.navigate("Agendamentos");
    if (action === "carteira") navigation.navigate("Carteira");
    if (action === "mensagens") navigation.navigate("Mensagens");
    if (action === "suporte") navigation.navigate("Suporte");
  }, [navigation]);

  const acionarSOS = useCallback(async () => {
    const servicoId = nextAgendamento?.id ?? agendamentos[0]?.id;
    if (!servicoId) {
      Alert.alert("SOS indisponível", "O SOS fica disponível quando houver um agendamento confirmado ou em andamento.");
      return;
    }
    try {
      setSosLoading(true);
      await acionarSosDiarista(servicoId);
      Alert.alert("SOS acionado", "A equipe de segurança foi notificada.");
    } catch {
      Alert.alert("Falha ao acionar SOS", "Não foi possível registrar o SOS no momento.");
    } finally {
      setSosLoading(false);
    }
  }, [nextAgendamento?.id, agendamentos]);

  return (
    <DScreen
      scroll
      withBottomPadding
      backgroundColor={profileTheme.background}
      refreshing={agendamentosLoading}
      refreshTintColor={profileTheme.primary}
      onRefresh={handleRefresh}
      contentContainerStyle={styles.scroll}
    >
      <TopBar
        firstName={firstName}
        avatarUrl={user?.avatarUrl ?? undefined}
        unreadMessages={unreadMessages}
        theme={profileTheme}
        onProfilePress={() => navigation.navigate("Perfil")}
        onBellPress={() => navigation.navigate("Mensagens")}
      />

      {restrictions.length > 0 && (() => {
        const r = restrictions[0];
        const isCritical = r.type === "SUSPEND" || r.type === "BLOCK";
        return (
          <View style={isCritical ? styles.restrictionBannerCrit : styles.restrictionBannerWarn}>
            <Text style={isCritical ? styles.restrictionTextCrit : styles.restrictionTextWarn}>
              {isCritical
                ? "⛔ Sua conta está suspensa. Entre em contato com o suporte."
                : "⚠️ Sua conta está com restrições ativas. Alguns recursos podem estar limitados."}
            </Text>
          </View>
        );
      })()}

      {/* ── Carteira (hero) ── */}
      <LinearGradient
        colors={profileTheme.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.earningsCard}
      >
        <View style={styles.earningsBlob} />
        <View style={styles.earningsTop}>
          <View>
            <View style={styles.earningsTitleRow}>
              <Text style={styles.earningsLabel}>Carteira</Text>
              <AppIcon name="Eye" size={15} color={colors.whiteAlpha80} strokeWidth={2.3} />
            </View>
            <Text style={styles.earningsPeriod}>Resumo financeiro</Text>
            <Text style={styles.earningsValue}>Abrir carteira</Text>
          </View>
          <View style={styles.cardIconBox}>
            <Wallet3DIcon size={44} />
          </View>
        </View>
        <Pressable style={styles.detailsLinkWrap} onPress={() => navigation.navigate("Carteira")}>
          <View style={styles.inlineLink}>
            <Text style={styles.detailsLink}>Ver detalhes</Text>
            <AppIcon name="ChevronRight" size={14} color={colors.whiteAlpha80} strokeWidth={2.4} />
          </View>
        </Pressable>
      </LinearGradient>

      {/* ── Segurança / atalhos (estilo Montador, com SOS) ── */}
      <View style={styles.securityGrid}>
        <Pressable
          onPress={() => navigation.navigate("VerificacaoDocs")}
          style={({ pressed }) => [styles.securityCard, { borderColor: profileTheme.border }, pressed && styles.pressed]}
        >
          <AppIcon name="ShieldCheck" size={22} color={profileTheme.primary} />
          <Text style={styles.securityTitle}>Verificação</Text>
          <Text style={styles.securitySub}>{perfilPendente ? "Pendente" : "Em dia"}</Text>
        </Pressable>
        <View style={[styles.securityCard, { borderColor: profileTheme.border }]}>
          <AppIcon name="Award" size={22} color={profileTheme.primary} />
          <Text style={styles.securityTitle}>SafeScore</Text>
          <Text style={styles.securitySub}>{restrictions.length > 0 ? "Atenção" : "Proteção ativa"}</Text>
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

      {/* ── Agendamentos de hoje ── */}
      <DCard style={styles.todayCard}>
        <DSectionHeader
          title="Agendamentos de hoje"
          action="Ver todos"
          onAction={() => navigation.navigate("Agendamentos")}
        />
        <View style={styles.divider} />
        {agendamentosLoading ? (
          <View style={styles.appointmentState}>
            <ActivityIndicator color={profileTheme.primary} />
          </View>
        ) : agendamentosError ? (
          <Text style={styles.appointmentStateText}>Não foi possível carregar seus agendamentos agora.</Text>
        ) : nextAgendamento ? (
          <AgendamentoItem agendamento={nextAgendamento} accentColor={profileTheme.primary} softBg={profileTheme.primarySoft} />
        ) : (
          <Text style={styles.appointmentStateText}>Nenhum agendamento encontrado.</Text>
        )}
        <View style={styles.divider} />
        <Pressable onPress={() => navigation.navigate("Agendamentos")}>
          <View style={styles.allAppointmentsRow}>
            <AppIcon name="Calendar" size={17} color={profileTheme.primary} strokeWidth={2.3} />
            <Text style={[styles.allAppointmentsText, { color: profileTheme.primary }]}>Ver todos os agendamentos</Text>
            <AppIcon name="ChevronRight" size={16} color={profileTheme.primary} strokeWidth={2.4} />
          </View>
        </Pressable>
      </DCard>

      {/* ── Ações rápidas ── */}
      <View style={styles.quickSection}>
        <DSectionHeader title="Ações rápidas" style={styles.sectionHeaderRow} />
        <View style={styles.quickGrid}>
          {QUICK_ACTIONS.map((item) => (
            <AcaoRapidaBtn
              key={item.id}
              icon={item.icon}
              label={item.label}
              accentColor={profileTheme.primary}
              softBg={profileTheme.primarySoft}
              onPress={() => handleQuickAction(item.id)}
            />
          ))}
        </View>
      </View>

      {/* ── Dica de hoje ── */}
      <DCard style={styles.tipCard}>
        <View style={[styles.tipIconBox, { backgroundColor: profileTheme.primarySoft }]}>
          <AppIcon name="ShieldCheck" size={22} color={profileTheme.primary} />
        </View>
        <View style={styles.tipText}>
          <Text style={styles.tipTitle}>Dica de hoje</Text>
          <Text style={styles.tipSubtitle}>
            Mantenha seu perfil sempre atualizado para receber mais agendamentos!
          </Text>
        </View>
        <View style={[styles.cleaningTipBox, { backgroundColor: profileTheme.primarySoft }]}>
          <AppIcon name="Sparkles" size={26} color={profileTheme.primary} strokeWidth={2.1} />
        </View>
      </DCard>

      {/* ── Meu desempenho ── */}
      <View style={styles.performanceSection}>
        <DSectionHeader title="Meu desempenho" style={styles.sectionHeaderRow} />
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <AppIcon name="Calendar" size={20} color={profileTheme.primary} strokeWidth={2} />
            <Text style={styles.metricValue}>{agendamentosLoading ? "--" : agendamentos.length}</Text>
            <Text style={styles.metricLabel}>Agendamentos</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricCard}>
            <AppIcon name="MessageCircle" size={20} color={profileTheme.primary} strokeWidth={2} />
            <Text style={styles.metricValue}>{unreadMessages}</Text>
            <Text style={styles.metricLabel}>Mensagens</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricCard}>
            <AppIcon name="ShieldCheck" size={20} color={restrictions.length > 0 ? colors.warning : colors.success} strokeWidth={2} />
            <Text style={styles.metricValue}>{restrictions.length}</Text>
            <Text style={styles.metricLabel}>Restrições</Text>
          </View>
        </View>
      </View>
    </DScreen>
  );
}

export default DiaristaHomeScreen;

const styles = StyleSheet.create({
  scroll: {
    gap: 14,
  },

  // ── Top bar: avatar → nome → sino ──
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatarRing: {
    borderWidth: 2,
    borderRadius: radius.pill,
    padding: 2,
  },
  topGreeting: {
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    ...typography.title,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  greetingSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  bellButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surface,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    ...shadows.soft,
  },
  bellBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    color: colors.white,
  },

  // ── Carteira (hero) ──
  earningsCard: {
    borderRadius: radius.xl,
    paddingVertical: 16,
    paddingHorizontal: 16,
    position: "relative",
    overflow: "hidden",
    ...shadows.primaryButton,
  },
  earningsBlob: {
    position: "absolute",
    right: -40,
    top: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.whiteAlpha08,
  },
  earningsTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  earningsTitleRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  earningsLabel: {
    ...typography.bodySmMedium,
    fontWeight: "600",
    color: colors.whiteAlpha90,
  },
  earningsPeriod: {
    ...typography.caption,
    color: colors.whiteAlpha70,
    marginTop: 2,
  },
  earningsValue: {
    ...typography.h2,
    fontWeight: "700",
    color: colors.white,
    marginTop: 6,
  },
  cardIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.whiteAlpha20,
    alignItems: "center",
    justifyContent: "center",
  },
  detailsLinkWrap: {
    alignSelf: "flex-end",
    marginTop: 12,
  },
  detailsLink: {
    ...typography.bodySm,
    color: colors.whiteAlpha80,
  },
  inlineLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },

  // ── Segurança / SOS grid ──
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

  // ── Agendamentos de hoje ──
  todayCard: {
    gap: 0,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  appointmentRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
  },
  timeBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  timeText: {
    ...typography.bodySmMedium,
    fontWeight: "700",
  },
  appointmentText: {
    flex: 1,
    minWidth: 0,
  },
  appointmentFamily: {
    ...typography.bodySmMedium,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  appointmentType: {
    ...typography.bodySm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  appointmentLocationRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.xs,
    alignItems: "center",
  },
  appointmentLocation: {
    flex: 1,
    ...typography.caption,
    color: colors.textSecondary,
  },
  appointmentState: {
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  appointmentStateText: {
    minHeight: 56,
    textAlignVertical: "center",
    color: colors.textSecondary,
    ...typography.bodySm,
  },
  allAppointmentsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  allAppointmentsText: {
    ...typography.bodySmMedium,
    fontWeight: "600",
  },

  // ── Ações rápidas ──
  quickSection: {
    marginTop: 2,
  },
  sectionHeaderRow: {
    marginBottom: spacing.md,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  quickAction: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 12,
    ...shadows.soft,
  },
  quickIconBox: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: {
    flex: 1,
    ...typography.caption,
    fontWeight: "600",
    color: colors.textPrimary,
  },

  // ── Dica de hoje ──
  tipCard: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
  },
  tipIconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  tipText: {
    flex: 1,
  },
  tipTitle: {
    ...typography.bodySmMedium,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  tipSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  cleaningTipBox: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Banner de restrição ──
  restrictionBannerWarn: {
    backgroundColor: colors.warningSoft,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
    padding: spacing.md,
    borderRadius: radius.sm,
  },
  restrictionBannerCrit: {
    backgroundColor: colors.dangerSoft,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    padding: spacing.md,
    borderRadius: radius.sm,
  },
  restrictionTextWarn: {
    color: colors.warningDark,
    ...typography.bodySm,
    fontWeight: "500",
  },
  restrictionTextCrit: {
    color: colors.incidentCritical,
    ...typography.bodySm,
    fontWeight: "500",
  },

  // ── Meu desempenho ──
  performanceSection: {
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  metricCard: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  metricDivider: {
    width: 1,
    backgroundColor: colors.divider,
    alignSelf: "stretch",
    marginHorizontal: spacing.sm,
  },
  metricValue: {
    ...typography.title,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  metricLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "500",
  },

  pressed: {
    opacity: 0.75,
  },
});
