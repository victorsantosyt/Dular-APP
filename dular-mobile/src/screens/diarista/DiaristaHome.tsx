import React from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/stores/authStore";
import { TAB_ROUTES } from "@/navigation/routes";
import { colors, gradients, shadow, spacing } from "@/theme/tokens";

const AVATAR_URI =
  "https://images.unsplash.com/photo-1607746882042-944635dfe10e?auto=format&fit=crop&w=240&q=80";

const SIZES = {
  headerHeight: 48,
  avatar: 82,
  welcomeTitle: 25,
  earningsHeight: 124,
  earningsValue: 28,
  agendaCardHeight: 220,
  quickActionHeight: 82,
  tipCardHeight: 124,
};

type QuickAction = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress?: () => void;
};

export default function DiaristaHome({ navigation }: any) {
  const user = useAuth((state) => state.user);
  const firstName = (user?.nome || "Maria").trim().split(/\s+/)[0] || "Maria";
  const tabNavigation = navigation?.getParent?.();

  const quickActions: QuickAction[] = [
    {
      icon: "calendar-outline",
      label: "Meus\nAgendamentos",
      onPress: () => tabNavigation?.navigate("Agendamentos"),
    },
    {
      icon: "wallet-outline",
      label: "Meus\nGanhos",
      onPress: () => tabNavigation?.navigate(TAB_ROUTES.CARTEIRA),
    },
    { icon: "star-outline", label: "Avaliações" },
    {
      icon: "chatbubble-outline",
      label: "Mensagens",
      onPress: () => tabNavigation?.navigate("Mensagens"),
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <Pressable hitSlop={12} style={styles.iconButton}>
            <Ionicons name="menu" size={26} color={colors.primary} />
          </Pressable>

          <View style={styles.logoWrap}>
            <Ionicons name="home-outline" size={30} color={colors.primary} />
            <Text allowFontScaling={false} style={styles.logoText}>Dular</Text>
          </View>

          <Pressable hitSlop={12} style={styles.bellButton}>
            <Ionicons name="notifications-outline" size={26} color={colors.primary} />
            <View style={styles.notificationBadge}>
              <Text allowFontScaling={false} style={styles.notificationText}>2</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.welcomeRow}>
          <View style={styles.welcomeCopy}>
            <Text allowFontScaling={false} style={styles.greeting}>Olá, {firstName}! 👋</Text>
            <Text allowFontScaling={false} style={styles.greetingSub}>Que bom te ver por aqui!</Text>
          </View>
          <View style={styles.avatarFrame}>
            <Image source={{ uri: user?.avatarUrl || AVATAR_URI }} style={styles.avatar} />
          </View>
        </View>

        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.earningsCard}
        >
          <View style={styles.cardWatermark} />
          <View style={styles.earningsLeft}>
            <View style={styles.earningsTitleRow}>
              <Text allowFontScaling={false} style={styles.earningsTitle}>Seus ganhos</Text>
              <Ionicons name="eye-outline" size={15} color={colors.whiteAlpha90} />
            </View>
            <Text allowFontScaling={false} style={styles.earningsPeriod}>Este mês</Text>
            <Text allowFontScaling={false} style={styles.earningsValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.86}>R$ 2.350,00</Text>
          </View>
          <View style={styles.walletGlass}>
            <Ionicons name="wallet-outline" size={25} color={colors.textOnPrimary} />
          </View>
          <Ionicons
            name="chevron-forward"
            size={24}
            color={colors.textOnPrimary}
            style={styles.earningsChevron}
          />
        </LinearGradient>

        <View style={styles.todayCard}>
          <View style={styles.todayHeader}>
            <Text allowFontScaling={false} style={styles.sectionTitle} numberOfLines={1}>Agendamentos de hoje</Text>
            <Pressable style={styles.linkRow} onPress={() => tabNavigation?.navigate("Agendamentos")}>
              <Text allowFontScaling={false} style={styles.linkText}>Ver todos</Text>
              <Ionicons name="chevron-forward" size={19} color={colors.primary} />
            </Pressable>
          </View>

          <View style={styles.appointmentRow}>
            <View style={styles.timeBox}>
              <Text allowFontScaling={false} style={styles.timeText}>09:00</Text>
            </View>
            <View style={styles.appointmentInfo}>
              <Text allowFontScaling={false} style={styles.familyName} numberOfLines={1}>Família Silva</Text>
              <Text allowFontScaling={false} style={styles.serviceName}>Limpeza geral</Text>
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={13} color={colors.primary} />
                <Text allowFontScaling={false} style={styles.locationText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.9}>
                  Jardim América, São Paulo
                </Text>
              </View>
            </View>
            <View style={styles.statusBadge}>
              <Text allowFontScaling={false} style={styles.statusText}>Confirmado</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Pressable style={styles.allAppointmentsRow} onPress={() => tabNavigation?.navigate("Agendamentos")}>
            <Ionicons name="calendar-outline" size={22} color={colors.primary} />
            <Text allowFontScaling={false} style={styles.allAppointmentsText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.9}>
              Ver todos os agendamentos
            </Text>
            <Ionicons name="chevron-forward" size={22} color={colors.primary} />
          </Pressable>
        </View>

        <View style={styles.quickSection}>
          <Text allowFontScaling={false} style={styles.quickTitle}>Ações rápidas</Text>
          <View style={styles.quickGrid}>
            {quickActions.map((action) => (
              <Pressable
                key={action.label}
                style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}
                onPress={action.onPress}
              >
                <Ionicons name={action.icon} size={25} color={colors.primary} />
                <Text allowFontScaling={false} style={styles.quickText} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.86}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <LinearGradient
          colors={gradients.soft}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.tipCard}
        >
          <View style={styles.tipShield}>
            <Ionicons name="shield-checkmark-outline" size={28} color={colors.primary} />
          </View>
          <View style={styles.tipCopy}>
            <Text allowFontScaling={false} style={styles.tipTitle}>Dica de hoje</Text>
            <Text allowFontScaling={false} style={styles.tipText} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.9}>
              Mantenha seu perfil sempre atualizado para receber mais agendamentos!
            </Text>
          </View>
          <View style={styles.cleaningVisual}>
            <View style={styles.bucket}>
              <View style={styles.bucketHandle} />
            </View>
            <View style={styles.sprayBottle}>
              <View style={styles.sprayTop} />
              <View style={styles.sprayBody} />
            </View>
            <View style={styles.sparkleOne} />
            <View style={styles.sparkleTwo} />
          </View>
        </LinearGradient>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingTop: 4,
    paddingHorizontal: 24,
    paddingBottom: 118,
  },
  header: {
    height: SIZES.headerHeight,
    marginBottom: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButton: {
    position: "absolute",
    left: -4,
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  bellButton: {
    position: "absolute",
    right: -4,
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  logoText: {
    fontSize: 29,
    lineHeight: 34,
    fontWeight: "800",
    color: colors.primary,
    letterSpacing: 0,
  },
  notificationBadge: {
    position: "absolute",
    top: 2,
    right: 1,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: colors.notification,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.background,
  },
  notificationText: {
    color: colors.textOnPrimary,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
  },
  welcomeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  welcomeCopy: {
    flex: 1,
  },
  greeting: {
    fontSize: SIZES.welcomeTitle,
    lineHeight: 30,
    fontWeight: "700",
    color: colors.textPrimary,
    letterSpacing: 0,
  },
  greetingSub: {
    marginTop: 5,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  avatarFrame: {
    width: SIZES.avatar,
    height: SIZES.avatar,
    borderRadius: SIZES.avatar / 2,
    overflow: "hidden",
    backgroundColor: colors.lavender,
    borderWidth: 3,
    borderColor: colors.surface,
    ...shadow.card,
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  earningsCard: {
    height: SIZES.earningsHeight,
    marginTop: 26,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    ...shadow.primaryButton,
  },
  cardWatermark: {
    position: "absolute",
    right: -42,
    bottom: -50,
    width: 152,
    height: 152,
    borderRadius: 42,
    borderWidth: 22,
    borderColor: colors.whiteAlpha08,
    transform: [{ rotate: "-18deg" }],
  },
  earningsLeft: {
    flex: 1,
  },
  earningsTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  earningsTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    color: colors.textOnPrimary,
  },
  earningsPeriod: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 18,
    color: colors.whiteAlpha80,
    fontWeight: "500",
  },
  earningsValue: {
    marginTop: 6,
    fontSize: SIZES.earningsValue,
    lineHeight: 34,
    fontWeight: "800",
    color: colors.textOnPrimary,
    letterSpacing: 0,
  },
  walletGlass: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.glassLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  earningsChevron: {
    marginLeft: 5,
  },
  todayCard: {
    height: SIZES.agendaCardHeight,
    marginTop: 22,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  todayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
    color: colors.textPrimary,
    letterSpacing: 0,
    flexShrink: 1,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexShrink: 0,
    marginLeft: 12,
  },
  linkText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "600",
    color: colors.primary,
  },
  appointmentRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  timeBox: {
    width: 68,
    height: 68,
    borderRadius: 15,
    backgroundColor: colors.lavenderSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  timeText: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "800",
    color: colors.primary,
  },
  appointmentInfo: {
    flex: 1,
    minWidth: 0,
  },
  familyName: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "700",
    color: colors.textPrimary,
    flexShrink: 1,
  },
  serviceName: {
    marginTop: spacing.xs,
    fontSize: 13,
    lineHeight: 17,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  locationRow: {
    marginTop: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  locationText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 15,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  statusBadge: {
    alignSelf: "flex-start",
    height: 28,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: colors.successSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  statusText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "700",
    color: colors.success,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginTop: 15,
    marginBottom: 13,
  },
  allAppointmentsRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  allAppointmentsText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "700",
    color: colors.primary,
  },
  quickSection: {
    marginTop: 24,
  },
  quickTitle: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 12,
  },
  quickGrid: {
    flexDirection: "row",
    gap: 12,
  },
  quickCard: {
    flex: 1,
    minWidth: 0,
    height: SIZES.quickActionHeight,
    borderRadius: 16,
    backgroundColor: colors.lavenderSoft,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  quickText: {
    fontSize: 11.5,
    lineHeight: 14,
    fontWeight: "600",
    color: colors.primary,
    textAlign: "center",
  },
  tipCard: {
    height: SIZES.tipCardHeight,
    marginTop: 22,
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  tipShield: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.whiteAlpha70,
    alignItems: "center",
    justifyContent: "center",
  },
  tipCopy: {
    flex: 1,
    marginLeft: spacing.md,
  },
  tipTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  tipText: {
    marginTop: 5,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  cleaningVisual: {
    width: 82,
    height: 92,
    marginLeft: 4,
  },
  bucket: {
    position: "absolute",
    left: 5,
    bottom: 7,
    width: 42,
    height: 35,
    borderRadius: 11,
    backgroundColor: colors.primaryLight,
    transform: [{ rotate: "-4deg" }],
  },
  bucketHandle: {
    position: "absolute",
    left: 8,
    top: -10,
    width: 27,
    height: 20,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderColor: colors.primary,
    borderRadius: 18,
  },
  sprayBottle: {
    position: "absolute",
    right: 7,
    bottom: 7,
    width: 28,
    height: 56,
  },
  sprayTop: {
    position: "absolute",
    left: 10,
    top: 0,
    width: 20,
    height: 12,
    borderRadius: 5,
    backgroundColor: colors.notification,
  },
  sprayBody: {
    position: "absolute",
    bottom: 0,
    left: 2,
    width: 25,
    height: 43,
    borderRadius: 13,
    backgroundColor: colors.lavenderStrong,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  sparkleOne: {
    position: "absolute",
    top: 8,
    left: 4,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.notification,
  },
  sparkleTwo: {
    position: "absolute",
    top: 0,
    right: 18,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
});
