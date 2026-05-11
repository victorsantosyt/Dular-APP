import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppIcon, AppIconName, DAvatar, DBadge, DBottomNav, DCard, DScreen, DSectionHeader } from "@/components/ui";
import { DularLogo } from "@/assets/brand";
import { Wallet3DIcon } from "@/assets/icons";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import { useAuthStore } from "@/store/authStore";
import type { DiaristaTabParamList } from "@/navigation/DiaristaNavigator";
import { getMyRestrictions, type UserRestriction } from "@/api/safeScoreApi";
import { useAgendamentosDiarista, type AgendamentoDiarista, type StatusDiarista } from "@/hooks/useAgendamentosDiarista";
import { useMensagens } from "@/hooks/useMensagens";
import { getProfileTheme } from "@/theme/profileTheme";

type Navigation = BottomTabNavigationProp<DiaristaTabParamList>;
type BadgeType = "default" | "success" | "warning" | "error" | "info" | "accent";
type QuickActionId = "agendamentos" | "carteira" | "avaliacoes" | "mensagens";

const QUICK_ACTIONS: { id: QuickActionId; icon: AppIconName; label: string; tone: "purple" | "pink" | "green" | "blue" }[] = [
  { id: "agendamentos", icon: "Calendar", label: "Meus\nAgendamentos", tone: "purple" },
  { id: "carteira", icon: "Wallet", label: "Meus\nGanhos", tone: "purple" },
  { id: "avaliacoes", icon: "Star", label: "Avaliações", tone: "pink" },
  { id: "mensagens", icon: "MessageCircle", label: "Mensagens", tone: "pink" },
];

function MenuIcon({ onPress }: { onPress: () => void }) {
  return (
    <Pressable hitSlop={spacing.sm} onPress={onPress}>
      <View style={styles.menuButton}>
        <View style={styles.menuLine} />
        <View style={styles.menuLine} />
        <View style={styles.menuLine} />
      </View>
    </Pressable>
  );
}

function TopBar({
  unreadMessages,
  onMenuPress,
  onMessagesPress,
}: {
  unreadMessages: number;
  onMenuPress: () => void;
  onMessagesPress: () => void;
}) {
  const badgeLabel = unreadMessages > 9 ? "9+" : String(unreadMessages);

  return (
    <View style={styles.topBar}>
      <MenuIcon onPress={onMenuPress} />

      <View style={styles.brandCenter}>
        <DularLogo size="sm" />
      </View>

      <Pressable hitSlop={spacing.sm} onPress={onMessagesPress}>
        <View style={styles.notificationButton}>
          <AppIcon name="Bell" size={20} color="purple" />
          {unreadMessages > 0 ? (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>{badgeLabel}</Text>
            </View>
          ) : null}
        </View>
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

function ShortcutBtn({
  icon,
  label,
  onPress,
  accentColor,
  softBg,
}: {
  icon: AppIconName;
  label: string;
  onPress: () => void;
  accentColor: string;
  softBg: string;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.shortcutItem, pressed && { opacity: 0.75 }]}>
      <View style={[styles.shortcutIcon, { backgroundColor: softBg }]}>
        <AppIcon name={icon} size={20} color={accentColor} strokeWidth={2.1} />
      </View>
      <Text style={styles.shortcutLabel}>{label}</Text>
    </Pressable>
  );
}

function AcaoRapidaBtn({
  icon,
  label,
  tone,
  onPress,
}: {
  icon: AppIconName;
  label: string;
  tone: "purple" | "pink" | "green" | "blue";
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && { opacity: 0.75 }]}>
      <View style={styles.quickIconBox}>
        <AppIcon name={icon} variant="soft" color={tone} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

export function DiaristaHomeScreen() {
  const navigation = useNavigation<Navigation>();
  const user = useAuthStore((state) => state.user);
  const firstName = (user?.nome || "Diarista").trim().split(/\s+/)[0];
  const profileTheme = getProfileTheme("DIARISTA", user?.genero);
  const { agendamentos, loading: agendamentosLoading, error: agendamentosError } = useAgendamentosDiarista();
  const { rooms } = useMensagens();

  const [restrictions, setRestrictions] = useState<UserRestriction[]>([]);
  const nextAgendamento = agendamentos[0];
  const unreadMessages = useMemo(
    () => rooms.reduce((total, room) => total + Math.max(0, Number(room.naoLidas) || 0), 0),
    [rooms],
  );
  const messagesBadge = unreadMessages > 0 ? unreadMessages : undefined;

  useEffect(() => {
    getMyRestrictions()
      .then(setRestrictions)
      .catch(() => []);
  }, []);

  const handleBottomNav = useCallback((tab: "home" | "search" | "new" | "messages" | "profile") => {
    if (tab === "new") navigation.navigate("Novo");
    if (tab === "messages") navigation.navigate("Mensagens");
    if (tab === "profile") navigation.navigate("Perfil");
    if (tab === "search") navigation.navigate("Agendamentos");
  }, [navigation]);

  const handleQuickAction = useCallback((action: QuickActionId) => {
    if (action === "agendamentos") navigation.navigate("Agendamentos");
    if (action === "carteira") navigation.navigate("Carteira");
    if (action === "mensagens") navigation.navigate("Mensagens");
    if (action === "avaliacoes") {
      Alert.alert("Em breve", "Avaliações ainda não têm uma tela própria.");
    }
  }, [navigation]);

  return (
    <DScreen backgroundColor={colors.background}>
      <View style={styles.content}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <TopBar
            unreadMessages={unreadMessages}
            onMenuPress={() => navigation.navigate("Perfil")}
            onMessagesPress={() => navigation.navigate("Mensagens")}
          />

          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Olá, {firstName}!</Text>
              <Text style={styles.greetingSub}>Que bom te ver por aqui!</Text>
            </View>
            <DAvatar size="md" uri={user?.avatarUrl ?? undefined} initials={firstName.slice(0, 2)} online />
          </View>

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

          <View style={styles.quickSection}>
            <DSectionHeader title="Ações rápidas" style={styles.sectionHeaderRow} />
            <View style={styles.quickGrid}>
              {QUICK_ACTIONS.map((item) => (
                <AcaoRapidaBtn
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  tone={item.tone}
                  onPress={() => handleQuickAction(item.id)}
                />
              ))}
            </View>
          </View>

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
            <View style={styles.cleaningTipBox}>
              <AppIcon name="Sparkles" size={32} color="pink" variant="soft" />
            </View>
          </DCard>

          {/* ── Performance ── */}
          <View style={styles.performanceSection}>
            <DSectionHeader title="Meu desempenho" style={styles.sectionHeaderRow} />
            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <AppIcon name="Calendar" size={20} color={colors.warning} strokeWidth={2} />
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
                <AppIcon name="ShieldCheck" size={20} color={colors.success} strokeWidth={2} />
                <Text style={styles.metricValue}>{restrictions.length}</Text>
                <Text style={styles.metricLabel}>Restrições</Text>
              </View>
            </View>
          </View>

          {/* ── Atalhos ── */}
          <View style={styles.shortcutsSection}>
            <DSectionHeader title="Atalhos" style={styles.sectionHeaderRow} />
            <View style={styles.shortcutsGrid}>
              <ShortcutBtn icon="Wallet" label="Carteira" accentColor={profileTheme.primary} softBg={profileTheme.primarySoft} onPress={() => navigation.navigate("Carteira")} />
              <ShortcutBtn icon="FileText" label="Documentos" accentColor={profileTheme.primary} softBg={profileTheme.primarySoft} onPress={() => navigation.navigate("VerificacaoDocs")} />
              <ShortcutBtn icon="MessageCircle" label="Mensagens" accentColor={profileTheme.primary} softBg={profileTheme.primarySoft} onPress={() => navigation.navigate("Mensagens")} />
              <ShortcutBtn icon="HelpCircle" label="Suporte" accentColor={profileTheme.primary} softBg={profileTheme.primarySoft} onPress={() => navigation.navigate("Suporte")} />
            </View>
          </View>
        </ScrollView>

        <DBottomNav activeTab="home" messagesBadge={messagesBadge} variant="diarista" onPress={handleBottomNav} />
      </View>
    </DScreen>
  );
}

export default DiaristaHomeScreen;

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  scroll: {
    paddingBottom: 112,
  },
  topBar: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 10,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLine: {
    width: 20,
    height: 2.5,
    backgroundColor: colors.textPrimary,
    borderRadius: 2,
    marginVertical: 2,
  },
  brandCenter: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    ...shadows.soft,
  },
  notificationBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadgeText: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.white,
  },
  header: {
    paddingHorizontal: spacing.screenPadding,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  earningsCard: {
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginHorizontal: spacing.screenPadding,
    marginBottom: 14,
    position: "relative",
    overflow: "hidden",
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
  todayCard: {
    marginHorizontal: spacing.screenPadding,
    marginBottom: 14,
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
    backgroundColor: colors.lavender,
    alignItems: "center",
    justifyContent: "center",
  },
  timeText: {
    ...typography.bodySmMedium,
    fontWeight: "700",
    color: colors.primary,
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
    color: colors.primary,
    ...typography.bodySmMedium,
    fontWeight: "600",
  },
  quickSection: {
    paddingHorizontal: spacing.screenPadding,
    marginBottom: 14,
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
    alignItems: "center",
    gap: 6,
  },
  quickIconBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  quickLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
  },
  tipCard: {
    marginHorizontal: spacing.screenPadding,
    marginBottom: 20,
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
  },
  tipIconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
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
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  cleaningTip: {
    ...typography.h2,
    textAlign: "center",
  },

  // Banner de restrição
  restrictionBannerWarn: {
    backgroundColor: colors.warningSoft,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.sm,
  },
  restrictionBannerCrit: {
    backgroundColor: colors.dangerSoft,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
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

  // Performance section
  performanceSection: {
    paddingHorizontal: spacing.screenPadding,
    marginBottom: 14,
  },
  metricsRow: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
    marginTop: spacing.md,
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

  // Shortcuts section
  shortcutsSection: {
    paddingHorizontal: spacing.screenPadding,
    marginBottom: 20,
  },
  shortcutsGrid: {
    flexDirection: "row",
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  shortcutItem: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  shortcutIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.lavender,
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutLabel: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.textSecondary,
    textAlign: "center",
  },
});
