import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppIcon, type AppIconName, DButton } from "@/components/ui";
import { onboardingAssets } from "@/assets/onboardingAssets";
import { colors, radius, spacing, typography } from "@/theme";
import { PageDots } from "@/components/onboarding/PageDots";
import type { OnboardingStackParamList } from "@/navigation/OnboardingNavigator";

type Navigation = NativeStackNavigationProp<OnboardingStackParamList>;
const LAVENDER_ICON = "#A98AEF";

export function SecurityScreen() {
  const navigation = useNavigation<Navigation>();
  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.replace("Benefits");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <Pressable
            onPress={handleBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Voltar para benefícios"
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          >
            <AppIcon name="ArrowLeft" size={20} color={colors.primary} strokeWidth={2.5} />
          </Pressable>
        </View>
        <PageDots total={4} active={2} />
        <View style={styles.headerSide} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>
            <Text style={styles.titleAccent}>Segurança</Text> que você pode confiar
          </Text>
          <Text style={styles.subtitle}>
            Recursos de confiança para proteger sua rotina, sua casa e seus dados.
          </Text>
        </View>

        <View style={styles.illustration}>
          <Image source={onboardingAssets.securityShield} style={styles.heroImage} resizeMode="cover" />
        </View>

        <View style={styles.benefits}>
          <Benefit icon="CheckCircle" text="Profissionais verificados com documentos" />
          <Benefit icon="ShieldCheck" text="SafeScore: mais confiança na sua escolha" />
          <Benefit icon="MessageCircle" text="Suporte rápido sempre que precisar" />
          <Benefit icon="Lock" text="Seus dados protegidos com sigilo total" />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <DButton label="Próximo" variant="primary" size="lg" onPress={() => navigation.navigate("Start")} />
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

export default SecurityScreen;

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
    paddingBottom: spacing.xs,
  },
  headerSide: {
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backButtonPressed: {
    opacity: 0.72,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing["4xl"],
    gap: spacing.xl,
  },
  titleBlock: {
    gap: spacing.sm,
  },
  title: {
    ...typography.h1,
    
    fontWeight: "700",
    color: colors.textPrimary,
  },
  titleAccent: {
    color: colors.accent,
  },
  subtitle: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  illustration: {
    height: 260,
    borderRadius: radius.xxl,
    backgroundColor: colors.lavenderSoft,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.lavenderStrong,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  benefits: {
    gap: spacing.md,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
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
    gap: spacing.lg,
  },
});
