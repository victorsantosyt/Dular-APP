import React from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppIcon, BackCircleButton, DButton, type AppIconName } from "@/components/ui";
import { onboardingAssets } from "@/assets/onboardingAssets";
import { colors, radius, spacing, typography } from "@/theme";
import { useTipografia } from "@/hooks/useTipografia";
import { PageDots } from "@/components/onboarding/PageDots";
import type { OnboardingStackParamList } from "@/navigation/OnboardingNavigator";

type Navigation = NativeStackNavigationProp<OnboardingStackParamList>;
const LAVENDER_ICON = "#A98AEF";

export function BenefitsScreen() {
  // Tamanho do título pela largura ATUAL (muda com o app aberto).
  const tipo = useTipografia();
  const navigation = useNavigation<Navigation>();
  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.replace("Welcome");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <BackCircleButton onPress={handleBack} color={colors.primary} />
        </View>
        <PageDots total={4} active={1} />
        <View style={styles.headerSide} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBlock}>
          <Text style={[styles.title, tipo.onboardingTitleWrap]}>
            Mais <Text style={styles.titleAccent}>praticidade</Text> para você
          </Text>
          <Text style={styles.subtitle}>
            O Dular organiza seus serviços e mantém tudo acessível em poucos toques.
          </Text>
        </View>

        <View style={styles.illustration}>
          <Image source={onboardingAssets.benefitsPhone} style={styles.heroImage} resizeMode="cover" />
        </View>

        <View style={styles.benefits}>
          <Benefit icon="Calendar" text="Agendamentos rápidos e flexíveis" />
          <Benefit icon="Heart" text="Recontrate seus favoritos com 1 clique" />
          <Benefit icon="FileText" text="Histórico completo de serviços" />
          <Benefit icon="Star" text="Avaliações e recomendações personalizadas" />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <DButton label="Próximo" variant="primary" size="lg" onPress={() => navigation.navigate("Security")} />
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

export default BenefitsScreen;

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
    alignItems: "center",
    justifyContent: "center",
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
