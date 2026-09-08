import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppIcon, BackCircleButton } from "@/components/ui";
import { onboardingAssets } from "@/assets/onboardingAssets";
import { colors, radius, spacing, typography } from "@/theme";
import { PageDots } from "@/components/onboarding/PageDots";
import { markOnboardingSeen } from "@/lib/onboarding";
import type { OnboardingStackParamList } from "@/navigation/OnboardingNavigator";

type Navigation = NativeStackNavigationProp<OnboardingStackParamList>;
const LAVENDER_ICON = "#A98AEF";

export function StartScreen() {
  const navigation = useNavigation<Navigation>();

  const start = async () => {
    await markOnboardingSeen();
    navigation.replace("RoleSelect");
  };
  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.replace("Security");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <BackCircleButton onPress={handleBack} color={colors.primary} />
        </View>
        <PageDots total={4} active={3} />
        <View style={styles.headerSide} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={1}>
            Hora de ter mais <Text style={styles.titleAccent}>liberdade</Text>
          </Text>
          <Text style={styles.subtitle}>
            Comece escolhendo o perfil que combina com a sua jornada no Dular.
          </Text>
        </View>

        <LinearGradient
          colors={[colors.accentLight, colors.primaryLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.illustration}
        >
          <Image source={onboardingAssets.startHero} style={styles.heroImage} resizeMode="cover" />
        </LinearGradient>

        <View style={styles.ctaCard}>
          <AppIcon name="Gift" size={24} color={LAVENDER_ICON} variant="soft" />
          <Text style={styles.ctaText}>Comece agora e tenha uma experiência incrível!</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={start} style={styles.startButtonWrap}>
          <LinearGradient
            colors={[colors.primary, colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.startButton}
          >
            <Text style={styles.startButtonText}>Vamos lá!</Text>
            <AppIcon name="ChevronRight" size={18} color={colors.surface} strokeWidth={2.5} />
          </LinearGradient>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export default StartScreen;

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
    overflow: "hidden",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  ctaCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.lavenderSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    // Sem borda: a linha clara de 1px aparecia como moldura
    // em volta da ilustração.
  },
  ctaText: {
    flex: 1,
    color: colors.textPrimary,
    fontWeight: "600",
    
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  startButtonWrap: {
    borderRadius: radius.full,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 7,
  },
  startButton: {
    width: "100%",
    paddingVertical: 15,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  startButtonText: {
    ...typography.bodyMedium,
    fontWeight: "700",
    color: colors.surface,
  },
});
