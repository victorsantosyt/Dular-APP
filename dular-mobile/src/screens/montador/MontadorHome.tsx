import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AppIcon, DScreen } from "@/components/ui";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import { useAuth } from "@/stores/authStore";
import { getProfileTheme } from "@/theme/profileTheme";
import type { Genero } from "@/theme/profileTheme";

const FEATURES = [
  {
    icon: "BriefcaseBusiness" as const,
    title: "Receba serviços",
    sub: "Aceite pedidos de montagem na sua região.",
  },
  {
    icon: "Wallet" as const,
    title: "Ganhos transparentes",
    sub: "Veja quanto você vai ganhar antes de aceitar.",
  },
  {
    icon: "Star" as const,
    title: "Construa reputação",
    sub: "Avaliações que destacam seu trabalho.",
  },
];

export function MontadorHome() {
  const clearSession = useAuth((state) => state.clearSession);
  const user = useAuth((state) => state.user);
  const selectedGenero = useAuth((state) => state.selectedGenero);
  const genero: Genero = user?.genero ?? selectedGenero ?? null;
  const profileTheme = getProfileTheme("MONTADOR", genero);

  return (
    <DScreen scroll contentContainerStyle={{ paddingHorizontal: 0, paddingTop: 0 }} backgroundColor={colors.background}>
      {/* Header */}
      <View style={s.header}>
        <View style={[s.logoMark, { backgroundColor: profileTheme.primarySoft }]}>
          <AppIcon name="Wrench" size={18} color={profileTheme.primary} strokeWidth={2.2} />
        </View>
        <Text style={s.headerTitle}>Dular Montador</Text>
      </View>

      {/* Hero */}
      <LinearGradient
        colors={profileTheme.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.hero}
      >
        <View style={s.heroBlob} />
        <View style={s.heroInner}>
          <View style={s.heroBadge}>
            <Text style={s.heroBadgeText}>Em breve</Text>
          </View>
          <Text style={s.heroTitle}>Área do Montador</Text>
          <Text style={s.heroSub}>
            Uma plataforma dedicada para montadores de móveis e instaladores
            profissionais.
          </Text>
        </View>
        <View style={s.heroIcon}>
          <AppIcon name="Wrench" size={72} color={colors.glassLight} strokeWidth={1} />
        </View>
      </LinearGradient>

      {/* Features preview */}
      <View style={s.features}>
        {FEATURES.map((f) => (
          <View key={f.title} style={s.featureRow}>
            <View style={[s.featureIcon, { backgroundColor: profileTheme.primarySoft }]}>
              <AppIcon name={f.icon} size={20} color={profileTheme.primary} strokeWidth={2} />
            </View>
            <View style={s.featureText}>
              <Text style={s.featureTitle}>{f.title}</Text>
              <Text style={s.featureSub}>{f.sub}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* CTA disabled */}
      <View style={s.ctaWrap}>
        <Pressable disabled style={[s.ctaBtn, { backgroundColor: profileTheme.primarySoft, borderColor: profileTheme.primary }]}>
          <Text style={[s.ctaLabel, { color: profileTheme.primaryDark }]}>Disponível em breve</Text>
          <AppIcon name="Clock" size={16} color={profileTheme.primaryDark} strokeWidth={2.2} />
        </Pressable>
        <Text style={s.ctaNote}>
          Estamos preparando tudo para os montadores do Dular.
        </Text>
      </View>

      <View style={s.logoutWrap}>
        <Pressable
          onPress={() => {
            void clearSession();
          }}
          style={({ pressed }) => [s.logoutBtn, pressed && s.logoutBtnPressed]}
          accessibilityRole="button"
        >
          <AppIcon name="LogOut" size={17} color={colors.textSecondary} strokeWidth={2.2} />
          <Text style={s.logoutLabel}>Sair do perfil</Text>
        </Pressable>
      </View>
    </DScreen>
  );
}

export default MontadorHome;

const s = StyleSheet.create({
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 10,
    paddingBottom: 12,
  },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: "#EAF7F3",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    ...typography.title,
    fontWeight: "700",
    color: colors.textPrimary,
  },

  // Hero
  hero: {
    marginHorizontal: spacing.screenPadding,
    borderRadius: 18,
    padding: 16,
    minHeight: 150,
    overflow: "hidden",
    position: "relative",
  },
  heroBlob: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.whiteAlpha08,
    right: -40,
    top: -40,
  },
  heroInner: {
    gap: spacing.sm,
    maxWidth: "68%",
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.glassLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  heroBadgeText: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.white,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  heroTitle: {
    ...typography.h2,
    fontWeight: "700",
    color: colors.white,
    
  },
  heroSub: {
    ...typography.bodySm,
    color: colors.whiteAlpha80,
    
    fontWeight: "400",
  },
  heroIcon: {
    position: "absolute",
    right: spacing.xl,
    bottom: spacing.lg,
    opacity: 0.18,
  },

  // Features
  features: {
    marginHorizontal: spacing.screenPadding,
    marginTop: 16,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  featureIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "#EAF7F3",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    ...typography.bodySmMedium,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  featureSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    
  },

  // CTA
  ctaWrap: {
    paddingHorizontal: spacing.screenPadding,
    marginTop: 16,
    marginBottom: 20,
    gap: spacing.sm,
    alignItems: "center",
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    width: "100%",
    height: 48,
    borderRadius: 18,
    backgroundColor: "#EAF7F3",
    borderWidth: 1,
    borderColor: "#4FA38F",
  },
  ctaLabel: {
    ...typography.bodySm,
    fontWeight: "700",
    color: "#2E6E61",
  },
  ctaNote: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    
  },

  // Temporary logout
  logoutWrap: {
    paddingHorizontal: spacing.screenPadding,
    marginBottom: spacing["3xl"],
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    width: "100%",
    minHeight: 44,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoutBtnPressed: {
    opacity: 0.72,
  },
  logoutLabel: {
    ...typography.bodySm,
    fontWeight: "700",
    color: colors.textSecondary,
  },
});
