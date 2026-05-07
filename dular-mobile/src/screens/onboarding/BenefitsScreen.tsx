import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppIcon, AppIconName, DAvatar, DButton, DCard } from "@/components/ui";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import { PageDots } from "@/components/onboarding/PageDots";
import { markOnboardingSeen } from "@/lib/onboarding";
import type { OnboardingStackParamList } from "@/navigation/OnboardingNavigator";

type Navigation = NativeStackNavigationProp<OnboardingStackParamList>;

export function BenefitsScreen() {
  const navigation = useNavigation<Navigation>();

  const skip = async () => {
    await markOnboardingSeen();
    navigation.replace("RoleSelect");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={skip} hitSlop={12}>
          <Text style={styles.skip}>Pular</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>
            Mais <Text style={styles.titleAccent}>praticidade</Text> para o seu dia
          </Text>
          <Text style={styles.subtitle}>
            O Dular organiza seus serviços e mantém tudo acessível em poucos toques.
          </Text>
        </View>

        <View style={styles.illustration}>
          <DCard style={styles.serviceCard}>
            <View style={styles.captionRow}>
              <AppIcon name="Calendar" size={13} color={colors.textSecondary} strokeWidth={2.2} />
              <Text style={styles.caption}>Próximo serviço</Text>
            </View>
            <Text style={styles.serviceTime}>15 Mai • 14:00 – 18:00</Text>
            <View style={styles.personRow}>
              <DAvatar size="sm" initials="MS" />
              <Text style={styles.personName}>Maria Silva</Text>
            </View>
            <View style={styles.confirmedBadge}>
              <AppIcon name="CheckCircle" size={13} color={colors.success} strokeWidth={2.4} />
              <Text style={styles.confirmedText}>Confirmado</Text>
            </View>
          </DCard>
        </View>

        <View style={styles.benefits}>
          <Benefit icon="Calendar" text="Agendamentos rápidos e flexíveis" />
          <Benefit icon="Heart" text="Recontrate suas favoritas com 1 clique" />
          <Benefit icon="FileText" text="Histórico completo de serviços" />
          <Benefit icon="Star" text="Avaliações e recomendações personalizadas" />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PageDots total={4} active={1} />
        <DButton label="Próximo" variant="primary" size="lg" onPress={() => navigation.navigate("Security")} />
      </View>
    </SafeAreaView>
  );
}

function Benefit({ icon, text }: { icon: AppIconName; text: string }) {
  return (
    <View style={styles.benefitRow}>
      <View style={styles.benefitIcon}>
        <AppIcon name={icon} size={16} color={colors.primary} strokeWidth={2.3} />
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
    alignItems: "flex-end",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  skip: {
    ...typography.bodyMd,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing["4xl"],
    gap: spacing.xl,
  },
  titleBlock: {
    gap: spacing.sm,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "800",
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
    minHeight: 260,
    borderRadius: radius.xxl,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
  },
  serviceCard: {
    width: 220,
    borderRadius: radius.lg,
    gap: spacing.sm,
    ...shadows.medium,
  },
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  captionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  serviceTime: {
    ...typography.h4,
    color: colors.textPrimary,
    fontWeight: "800",
  },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  personName: {
    ...typography.bodyMd,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  confirmedBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.successLight,
  },
  confirmedText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.success,
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
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
});
