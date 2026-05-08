import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as ExpoSplashScreen from "expo-splash-screen";
import OnboardingNavigator from "@/navigation/OnboardingNavigator";
import ClienteNavigator from "@/navigation/ClienteNavigator";
import DiaristaNavigator from "@/navigation/DiaristaNavigator";
import { useAuthStore } from "@/store/authStore";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { hasSeenOnboarding } from "@/lib/onboarding";
import { colors } from "@/theme";

function AuthenticatedFlow({ role }: { role: string | null }) {
  usePushNotifications();

  const normalizedRole = role?.toLowerCase();
  if (normalizedRole === "empregador") return <ClienteNavigator />;
  if (normalizedRole === "diarista") return <DiaristaNavigator />;
  if (normalizedRole === "montador") return <MontadorPlaceholder />;

  return <OnboardingNavigator initialRouteName="RoleSelect" />;
}

function MontadorPlaceholder() {
  return (
    <View style={styles.placeholderScreen}>
      <Text style={styles.placeholderTitle}>Perfil Montador</Text>
      <Text style={styles.placeholderText}>A area operacional de montadores ainda esta em preparacao.</Text>
    </View>
  );
}

export function RootNavigator() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const role = useAuthStore((state) => state.role);
  const hydrated = useAuthStore((state) => state.hydrated);
  const hydrate = useAuthStore((state) => state.hydrate);
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      try {
        await hydrate();
      } finally {
        try {
          const seen = await hasSeenOnboarding();
          if (mounted) setOnboardingSeen(seen);
        } catch {
          if (mounted) setOnboardingSeen(false);
        }
      }
    };

    boot();
    return () => {
      mounted = false;
    };
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && onboardingSeen !== null) {
      ExpoSplashScreen.hideAsync().catch(() => {});
    }
  }, [hydrated, onboardingSeen]);

  if (!hydrated || onboardingSeen === null) {
    return <View style={styles.bootScreen} />;
  }

  if (!isAuthenticated) {
    return <OnboardingNavigator initialRouteName={onboardingSeen ? "RoleSelect" : "Splash"} />;
  }

  return <AuthenticatedFlow role={role} />;
}

export default RootNavigator;

const styles = StyleSheet.create({
  bootScreen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  placeholderScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: colors.background,
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.textPrimary,
    textAlign: "center",
  },
  placeholderText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
