import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppIcon, AppIconName } from "@/components/ui";
import { ClienteRelaxImage } from "@/assets/images/people";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import { PageDots } from "@/components/onboarding/PageDots";
import { markOnboardingSeen } from "@/lib/onboarding";
import type { OnboardingStackParamList } from "@/navigation/OnboardingNavigator";

type Navigation = NativeStackNavigationProp<OnboardingStackParamList>;

export function StartScreen() {
  const navigation = useNavigation<Navigation>();
  const anims = useMemo(
    () => [new Animated.Value(0), new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)],
    []
  );

  useEffect(() => {
    anims.forEach((value, index) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: -8,
            duration: 850 + index * 120,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 850 + index * 120,
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  }, [anims]);

  const start = async () => {
    await markOnboardingSeen();
    navigation.replace("RoleSelect");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>
            Pronta para ter <Text style={styles.titleAccent}>mais tempo</Text> para você?
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
          <FloatIcon icon="Heart" style={styles.iconTopLeft} translateY={anims[0]} />
          <FloatIcon icon="Calendar" style={styles.iconTopRight} translateY={anims[1]} />
          <FloatIcon icon="Star" style={styles.iconBottomLeft} translateY={anims[2]} />
          <FloatIcon icon="CheckCircle" style={styles.iconBottomRight} translateY={anims[3]} />
          <View style={styles.heroPerson}>
            <ClienteRelaxImage />
          </View>
        </LinearGradient>

        <View style={styles.ctaCard}>
          <AppIcon name="Gift" size={24} color={colors.primary} variant="soft" />
          <Text style={styles.ctaText}>Comece agora e tenha uma experiência incrível!</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PageDots total={4} active={3} />
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

function FloatIcon({
  icon,
  style,
  translateY,
}: {
  icon: AppIconName;
  style: object;
  translateY: Animated.Value;
}) {
  return (
    <Animated.View style={[styles.floatIcon, style, { transform: [{ translateY }] }]}>
      <AppIcon name={icon} size={22} color={colors.primary} strokeWidth={2.4} />
    </Animated.View>
  );
}

export default StartScreen;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing["4xl"],
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
    height: 280,
    borderRadius: radius.xxl,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  heroPerson: {
    width: 172,
  },
  floatIcon: {
    position: "absolute",
    width: 50,
    height: 50,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  iconTopLeft: {
    top: spacing.lg,
    left: spacing.lg,
  },
  iconTopRight: {
    top: spacing.xl,
    right: spacing.xl,
  },
  iconBottomLeft: {
    bottom: spacing.xl,
    left: spacing.xl,
  },
  iconBottomRight: {
    bottom: spacing.lg,
    right: spacing.lg,
  },
  ctaCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  ctaText: {
    flex: 1,
    color: colors.primary,
    fontWeight: "600",
    lineHeight: 20,
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
    fontSize: 16,
    fontWeight: "700",
    color: colors.surface,
  },
});
