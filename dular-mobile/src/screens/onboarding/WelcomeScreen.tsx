import React from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppIcon, AppIconName, DButton } from "@/components/ui";
import { onboardingAssets } from "@/assets/onboardingAssets";
import { colors, radius, spacing, typography } from "@/theme";
import { PageDots } from "@/components/onboarding/PageDots";
import type { OnboardingStackParamList } from "@/navigation/OnboardingNavigator";

type Navigation = NativeStackNavigationProp<OnboardingStackParamList>;
const LAVENDER_ICON = "#A98AEF";

export function WelcomeScreen() {
  const navigation = useNavigation<Navigation>();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerSide} />
        <PageDots total={4} active={0} />
        <View style={styles.headerSide} />
      </View>

      <View style={styles.welcomeLogoWrap}>
        <Image source={onboardingAssets.welcomeLogo} style={styles.welcomeLogo} resizeMode="contain" />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.contentGroup}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>
              Bem-vindo ao <Text style={styles.titleAccent}>Dular!</Text>
            </Text>
            <Text style={styles.subtitle}>
              Uma forma mais simples, segura e acolhedora de cuidar da rotina da sua casa.
            </Text>
          </View>

          <View style={styles.illustration}>
            <Image source={onboardingAssets.welcomeHero} style={styles.heroImage} resizeMode="cover" />
          </View>

          <View style={styles.benefits}>
            <Benefit icon="Search" text="Encontre com facilidade profissionais confiáveis" />
            <Benefit icon="Calendar" text="Agende em poucos cliques e economize tempo" />
            <Benefit icon="ShieldCheck" text="Tudo com mais segurança e praticidade" />
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <DButton label="Próximo" variant="primary" size="lg" onPress={() => navigation.navigate("Benefits")} />
      </View>
    </SafeAreaView>
  );
}

function Benefit({ icon, text }: { icon: AppIconName; text: string }) {
  return (
    <View style={styles.benefitRow}>
      <View style={styles.benefitIcon}>
        <AppIcon name={icon} size={16} color={LAVENDER_ICON} strokeWidth={2.3} />
      </View>
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

export default WelcomeScreen;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: 0,
    minHeight: 32,
  },
  headerSide: {
    flex: 1,
  },
  welcomeLogoWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 6,
    paddingBottom: 2,
  },
  welcomeLogo: {
    width: 212,
    height: 78,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  contentGroup: {
    alignSelf: "stretch",
    gap: 14,
    transform: [{ translateY: -8 }],
  },
  titleBlock: {
    alignItems: "center",
    gap: 6,
  },
  title: {
    ...typography.h1,
    
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  titleAccent: {
    color: colors.accent,
  },
  subtitle: {
    ...typography.bodyMd,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 316,
  },
  illustration: {
    height: 248,
    borderRadius: radius.xxl,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: colors.lavenderSoft,
    borderWidth: 1,
    borderColor: colors.lavenderStrong,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  benefits: {
    gap: 10,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 42,
  },
  benefitIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.lavenderSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: {
    flex: 1,
    ...typography.bodySm,
    
    color: colors.textSecondary,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
});
