import React from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppIcon, BackCircleButton, DButton, type AppIconName } from "@/components/ui";
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
          <BackCircleButton onPress={handleBack} color={colors.primary} />
        </View>
        <PageDots total={4} active={2} />
        <View style={styles.headerSide} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>
            <Text style={styles.titleAccent}>Segurança</Text> em um só lugar
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
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing["4xl"],
    gap: spacing.xl,
  },
  titleBlock: {
    gap: spacing.sm,
    alignItems: "center",
  },
  title: {
    // Token compartilhado pelas quatro telas do onboarding — ver
    // `onboardingTitle` em theme/typography. Antes cada tela definia o
    // próprio corpo e eles divergiram.
    ...typography.onboardingTitle,
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
  },
  illustration: {
    // Proporção da própria arte (1619x971 = 5:3) em vez de altura fixa: a
    // caixa acompanha a largura do aparelho e bate com a imagem, então o
    // "cover" não corta nada em nenhuma tela. Altura cravada só acertava o
    // aparelho onde foi calibrada; nas outras sobrava faixa ou cortava a arte.
    width: "100%",
    aspectRatio: 5 / 3,
    maxHeight: 300,
    borderRadius: radius.xxl,
    backgroundColor: colors.lavenderSoft,
    overflow: "hidden",
    // Sem borda: a linha clara de 1px aparecia como moldura
    // em volta da ilustração.
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
