import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import * as ExpoSplashScreen from "expo-splash-screen";
import OnboardingNavigator from "@/navigation/OnboardingNavigator";
import EmpregadorNavigator from "@/navigation/EmpregadorNavigator";
import DiaristaNavigator from "@/navigation/DiaristaNavigator";
import MontadorNavigator from "@/navigation/MontadorNavigator";
import { useAuthStore } from "@/stores/authStore";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { hasSeenOnboarding } from "@/lib/onboarding";
import { colors } from "@/theme";

function AuthenticatedFlow({ role }: { role: string | null }) {
  usePushNotifications();

  const normalizedRole = role?.toLowerCase();
  if (normalizedRole === "empregador") return <EmpregadorNavigator />;
  if (normalizedRole === "diarista") return <DiaristaNavigator />;
  if (normalizedRole === "montador") return <MontadorNavigator />;

  return <OnboardingNavigator initialRouteName="RoleSelect" />;
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
});
