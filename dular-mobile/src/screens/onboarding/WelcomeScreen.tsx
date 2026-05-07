import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppIcon, AppIconName, DAvatar, DButton, DCard } from "@/components/ui";
import { ClientePhoneImage } from "@/assets/images/people";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import { PageDots } from "@/components/onboarding/PageDots";
import { markOnboardingSeen } from "@/lib/onboarding";
import type { OnboardingStackParamList } from "@/navigation/OnboardingNavigator";

type Navigation = NativeStackNavigationProp<OnboardingStackParamList>;

export function WelcomeScreen() {
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
            Bem-vindo ao <Text style={styles.titleAccent}>Dular!</Text>
          </Text>
          <Text style={styles.subtitle}>
            Uma forma mais simples, segura e acolhedora de cuidar da rotina da sua casa.
          </Text>
        </View>

        <LinearGradient
          colors={[colors.primaryLight, colors.accentLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.illustration}
        >
          <DCard style={styles.floatLeft}>
            <View style={styles.personRow}>
              <DAvatar size="sm" initials="MS" />
              <View>
                <Text style={styles.floatTitle}>Maria Silva</Text>
                <View style={styles.stars}>
                  {[0, 1, 2, 3, 4].map((item) => (
                    <AppIcon key={item} name="Star" size={10} color={colors.warning} strokeWidth={2.4} />
                  ))}
                </View>
              </View>
            </View>
          </DCard>

          <DCard style={styles.floatRight}>
            <View style={styles.confirmedRow}>
              <AppIcon name="CheckCircle" size={14} color={colors.success} strokeWidth={2.4} />
              <Text style={styles.confirmed}>Agendamento confirmado</Text>
            </View>
          </DCard>

          <View style={styles.heroPerson}>
            <ClientePhoneImage />
          </View>
        </LinearGradient>

        <View style={styles.benefits}>
          <Benefit icon="Search" text="Encontre com facilidade profissionais confiáveis" />
          <Benefit icon="Calendar" text="Agende em poucos cliques e economize tempo" />
          <Benefit icon="ShieldCheck" text="Tudo com mais segurança e praticidade" />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PageDots total={4} active={0} />
        <DButton label="Próximo" variant="primary" size="lg" onPress={() => navigation.navigate("Benefits")} />
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

export default WelcomeScreen;

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
    height: 260,
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  floatLeft: {
    position: "absolute",
    left: spacing.lg,
    top: spacing.xl,
    padding: spacing.md,
    borderRadius: 14,
    ...shadows.soft,
  },
  floatRight: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.xl,
    padding: spacing.md,
    borderRadius: 14,
    ...shadows.soft,
  },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  floatTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  stars: {
    flexDirection: "row",
    gap: 1,
  },
  confirmed: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.success,
  },
  confirmedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  heroPerson: {
    width: 160,
    alignSelf: "center",
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
