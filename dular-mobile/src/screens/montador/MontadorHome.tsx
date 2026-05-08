import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AppIcon, DScreen } from "@/components/ui";
import { colors, gradients, radius, shadows, spacing } from "@/theme";

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
  return (
    <DScreen scroll contentContainerStyle={{ paddingHorizontal: 0, paddingTop: 0 }} backgroundColor={colors.background}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.logoMark}>
          <AppIcon name="Wrench" size={18} color={colors.teal} strokeWidth={2.2} />
        </View>
        <Text style={s.headerTitle}>Dular Montador</Text>
      </View>

      {/* Hero */}
      <LinearGradient
        colors={gradients.montador}
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
            <View style={s.featureIcon}>
              <AppIcon name={f.icon} size={20} color={colors.teal} strokeWidth={2} />
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
        <Pressable disabled style={s.ctaBtn}>
          <Text style={s.ctaLabel}>Disponível em breve</Text>
          <AppIcon name="Clock" size={16} color={colors.tealDark} strokeWidth={2.2} />
        </Pressable>
        <Text style={s.ctaNote}>
          Estamos preparando tudo para os montadores do Dular.
        </Text>
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
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.tealSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.textPrimary,
  },

  // Hero
  hero: {
    marginHorizontal: spacing.screenPadding,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    minHeight: 180,
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
    fontSize: 11,
    fontWeight: "700",
    color: colors.white,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.white,
    lineHeight: 32,
  },
  heroSub: {
    fontSize: 13,
    color: colors.whiteAlpha80,
    lineHeight: 18,
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
    marginTop: spacing.sectionGap,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.lg,
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
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.tealSoft,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  featureSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },

  // CTA
  ctaWrap: {
    paddingHorizontal: spacing.screenPadding,
    marginTop: spacing.sectionGap,
    marginBottom: spacing.xl,
    gap: spacing.sm,
    alignItems: "center",
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    width: "100%",
    height: 52,
    borderRadius: radius.xl,
    backgroundColor: colors.tealSoft,
    borderWidth: 1,
    borderColor: colors.teal,
  },
  ctaLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.tealDark,
  },
  ctaNote: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 17,
  },
});
