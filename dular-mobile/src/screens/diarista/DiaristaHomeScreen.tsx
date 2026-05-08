import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppIcon, AppIconName, DAvatar, DBadge, DBottomNav, DCard } from "@/components/ui";
import { DularLogo } from "@/assets/brand";
import { Wallet3DIcon } from "@/assets/icons";
import { colors, radius, shadows, spacing } from "@/theme";
import { useAuthStore } from "@/store/authStore";
import type { DiaristaTabParamList } from "@/navigation/DiaristaNavigator";
import { getMyRestrictions, type UserRestriction } from "@/api/safeScoreApi";

type Navigation = BottomTabNavigationProp<DiaristaTabParamList>;

const QUICK_ACTIONS: { icon: AppIconName; label: string; tone: "purple" | "pink" | "green" | "blue" }[] = [
  { icon: "Calendar", label: "Meus\nAgendamentos", tone: "purple" },
  { icon: "Wallet", label: "Meus\nGanhos", tone: "purple" },
  { icon: "Star", label: "Avaliações", tone: "pink" },
  { icon: "MessageCircle", label: "Mensagens", tone: "pink" },
];

function MenuIcon() {
  return (
    <Pressable hitSlop={spacing.sm}>
      <View style={styles.menuButton}>
        <View style={styles.menuLine} />
        <View style={styles.menuLine} />
        <View style={styles.menuLine} />
      </View>
    </Pressable>
  );
}

function TopBar() {
  return (
    <View style={styles.topBar}>
      <MenuIcon />

      <View style={styles.brandCenter}>
        <DularLogo size="sm" />
      </View>

      <Pressable hitSlop={spacing.sm}>
        <View style={styles.notificationButton}>
          <AppIcon name="Bell" size={20} color="purple" />
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationBadgeText}>2</Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

function AgendamentoItem() {
  return (
    <View style={styles.appointmentRow}>
      <View style={styles.timeBox}>
        <AppIcon name="Clock" size={18} color="purple" />
        <Text style={styles.timeText}>09:00</Text>
      </View>
      <View style={styles.appointmentText}>
        <Text style={styles.appointmentFamily}>Família Silva</Text>
        <Text style={styles.appointmentType}>Limpeza geral</Text>
        <View style={styles.appointmentLocationRow}>
          <AppIcon name="MapPin" size={12} color={colors.textSecondary} />
          <Text style={styles.appointmentLocation}>Jardim América, São Paulo</Text>
        </View>
      </View>
      <DBadge type="success" label="Confirmado" />
    </View>
  );
}

function AcaoRapidaBtn({ icon, label, tone }: { icon: AppIconName; label: string; tone: "purple" | "pink" | "green" | "blue" }) {
  return (
    <View style={styles.quickAction}>
      <View style={styles.quickIconBox}>
        <AppIcon name={icon} variant="soft" color={tone} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </View>
  );
}

export function DiaristaHomeScreen() {
  const navigation = useNavigation<Navigation>();
  const user = useAuthStore((state) => state.user);
  const firstName = (user?.nome || "Diarista").trim().split(/\s+/)[0];

  const [restrictions, setRestrictions] = useState<UserRestriction[]>([]);

  useEffect(() => {
    getMyRestrictions()
      .then(setRestrictions)
      .catch(() => []);
  }, []);

  const handleBottomNav = (tab: "home" | "search" | "new" | "messages" | "profile") => {
    if (tab === "new") navigation.navigate("Novo");
    if (tab === "messages") navigation.navigate("Mensagens");
    if (tab === "profile") navigation.navigate("Perfil");
    if (tab === "search") navigation.navigate("Agendamentos");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <TopBar />

          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Olá, {firstName}!</Text>
              <Text style={styles.greetingSub}>Que bom te ver por aqui!</Text>
            </View>
            <DAvatar size="lg" uri={user?.avatarUrl ?? undefined} initials={firstName.slice(0, 2)} online />
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
            colors={[colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.earningsCard}
          >
            <View style={styles.earningsBlob} />
            <View style={styles.earningsTop}>
              <View>
                <View style={styles.earningsTitleRow}>
                  <Text style={styles.earningsLabel}>Seus ganhos</Text>
                  <AppIcon name="Eye" size={15} color={colors.whiteAlpha80} strokeWidth={2.3} />
                </View>
                <Text style={styles.earningsPeriod}>Este mês</Text>
                <Text style={styles.earningsValue}>R$ 2.350,00</Text>
              </View>
              <View style={styles.cardIconBox}>
                <Wallet3DIcon size={44} />
              </View>
            </View>
            <Pressable style={styles.detailsLinkWrap}>
              <View style={styles.inlineLink}>
                <Text style={styles.detailsLink}>Ver detalhes</Text>
                <AppIcon name="ChevronRight" size={14} color={colors.whiteAlpha80} strokeWidth={2.4} />
              </View>
            </Pressable>
          </LinearGradient>

          <DCard style={styles.todayCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Agendamentos de hoje</Text>
              <Pressable onPress={() => navigation.navigate("Agendamentos")}>
                <View style={styles.inlineLink}>
                  <Text style={styles.cardLink}>Ver todos</Text>
                  <AppIcon name="ChevronRight" size={14} color={colors.primary} strokeWidth={2.4} />
                </View>
              </Pressable>
            </View>
            <View style={styles.divider} />
            <AgendamentoItem />
            <View style={styles.divider} />
            <Pressable onPress={() => navigation.navigate("Agendamentos")}>
              <View style={styles.allAppointmentsRow}>
                <AppIcon name="Calendar" size={17} color={colors.primary} strokeWidth={2.3} />
                <Text style={styles.allAppointmentsText}>Ver todos os agendamentos</Text>
                <AppIcon name="ChevronRight" size={16} color={colors.primary} strokeWidth={2.4} />
              </View>
            </Pressable>
          </DCard>

          <View style={styles.quickSection}>
            <Text style={styles.sectionTitle}>Ações rápidas</Text>
            <View style={styles.quickGrid}>
              {QUICK_ACTIONS.map((item) => (
                <AcaoRapidaBtn key={item.label} icon={item.icon} label={item.label} tone={item.tone} />
              ))}
            </View>
          </View>

          <DCard style={styles.tipCard}>
            <View style={styles.tipIconBox}>
              <AppIcon name="ShieldCheck" variant="soft" color="purple" />
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
        </ScrollView>

        <DBottomNav activeTab="home" messagesBadge={2} variant="diarista" onPress={handleBottomNav} />
      </View>
    </SafeAreaView>
  );
}

export default DiaristaHomeScreen;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  scroll: {
    paddingBottom: spacing["5xl"],
  },
  topBar: {
    padding: spacing.lg,
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
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.white,
  },
  header: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greeting: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  greetingSub: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  earningsCard: {
    borderRadius: radius.xxl,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
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
    fontSize: 14,
    fontWeight: "600",
    color: colors.whiteAlpha90,
  },
  eye: {
    fontSize: 14,
  },
  earningsPeriod: {
    fontSize: 12,
    color: colors.whiteAlpha70,
    marginTop: 2,
  },
  earningsValue: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.white,
    marginTop: 6,
  },
  cardIconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.whiteAlpha20,
    alignItems: "center",
    justifyContent: "center",
  },
  detailsLinkWrap: {
    alignSelf: "flex-end",
    marginTop: spacing.md,
  },
  detailsLink: {
    fontSize: 13,
    color: colors.whiteAlpha80,
  },
  inlineLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  todayCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  cardLink: {
    color: colors.primary,
    fontSize: 13,
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
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  timeText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  appointmentText: {
    flex: 1,
  },
  appointmentFamily: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  appointmentType: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  appointmentLocationRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.xs,
    alignItems: "center",
  },
  locationIcon: {
    fontSize: 11,
  },
  appointmentLocation: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  allAppointmentsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  allAppointmentsText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  quickSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
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
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  quickLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: "center",
  },
  tipCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
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
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  tipSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  cleaningTipBox: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  cleaningTip: {
    fontSize: 28,
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
    fontSize: 13,
    fontWeight: "500",
  },
  restrictionTextCrit: {
    color: colors.incidentCritical,
    fontSize: 13,
    fontWeight: "500",
  },
});
