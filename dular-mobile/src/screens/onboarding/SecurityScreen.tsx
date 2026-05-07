import React, { useEffect, useRef } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppIcon, AppIconName, DBadge, DButton, DCard } from "@/components/ui";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import { PageDots } from "@/components/onboarding/PageDots";
import { markOnboardingSeen } from "@/lib/onboarding";
import type { OnboardingStackParamList } from "@/navigation/OnboardingNavigator";

type Navigation = NativeStackNavigationProp<OnboardingStackParamList>;

export function SecurityScreen() {
  const navigation = useNavigation<Navigation>();
  const floatY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          toValue: -8,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(floatY, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [floatY]);

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
            <Text style={styles.titleAccent}>Segurança</Text> que você pode confiar
          </Text>
          <Text style={styles.subtitle}>
            Recursos de confiança para proteger sua rotina, sua casa e seus dados.
          </Text>
        </View>

        <View style={styles.illustration}>
          <Animated.View style={[styles.shield, { transform: [{ translateY: floatY }] }]}>
            <AppIcon name="ShieldCheck" size={70} color="purple" variant="filled" strokeWidth={2.4} />
          </Animated.View>

          <DCard style={styles.scoreCard}>
            <View style={styles.scoreRow}>
              <View style={styles.scoreIcon}>
                <AppIcon name="ShieldCheck" size={20} color={colors.primary} strokeWidth={2.4} />
              </View>
              <View style={styles.scoreText}>
                <Text style={styles.caption}>SafeScore</Text>
                <Text style={styles.scoreValue}>9.8</Text>
              </View>
              <DBadge label="Excelente" type="success" />
            </View>
          </DCard>
        </View>

        <View style={styles.benefits}>
          <Benefit icon="CheckCircle" text="Profissionais verificados com documentos" />
          <Benefit icon="ShieldCheck" text="SafeScore: mais confiança na sua escolha" />
          <Benefit icon="MessageCircle" text="Suporte rápido sempre que precisar" />
          <Benefit icon="Lock" text="Seus dados protegidos com sigilo total" />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PageDots total={4} active={2} />
        <DButton label="Próximo" variant="primary" size="lg" onPress={() => navigation.navigate("Start")} />
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

export default SecurityScreen;

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
    gap: spacing.xl,
  },
  shield: {
    width: 134,
    height: 134,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreCard: {
    width: "100%",
    borderRadius: 14,
    ...shadows.soft,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  scoreIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreText: {
    flex: 1,
  },
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.textPrimary,
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
