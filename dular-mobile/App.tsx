import { NavigationContainer, DefaultTheme, Theme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import ClienteTabs from "@/navigation/ClienteTabs";
import DiaristaTabs from "@/navigation/DiaristaTabs";
import AuthStack from "@/navigation/AuthStack";
import DularSplashScreen from "@/screens/onboarding/DularSplashScreen";
import OnboardingScreen from "@/screens/onboarding/OnboardingScreen";
import { colors } from "@/theme/tokens";
import { navRef } from "@/navigation/nav";
import { useAuth } from "@/stores/authStore";
import {
  getOnboardingSeenValue,
  markOnboardingSeen,
  ONBOARDING_KEY,
  resetOnboardingSeen,
} from "@/lib/onboarding";

export default function App() {
  const { token, role, clearSession, hydrate } = useAuth();
  const [booting, setBooting] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);

  const navTheme: Theme = useMemo(() => {
    return {
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.textPrimary,
        border: colors.border,
        notification: colors.notification,
      },
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    let splashTimer: ReturnType<typeof setTimeout> | undefined;

    async function boot() {
      try {
        console.log("[BOOT] onboarding key:", ONBOARDING_KEY);
        await hydrate();

        if (__DEV__) {
          await resetOnboardingSeen();
          console.log("[BOOT] onboarding resetado em DEV");
        }

        const onboardingSeenValue = await getOnboardingSeenValue();
        const seen = onboardingSeenValue === "true";
        const currentAuth = useAuth.getState();

        console.log("[BOOT] token:", !!currentAuth.token);
        console.log("[BOOT] role:", currentAuth.role);
        console.log("[BOOT] onboardingSeen:", onboardingSeenValue);
        console.log("[BOOT] hasSeenOnboarding:", seen);

        if (mounted) setOnboardingSeen(seen);
      } catch (error) {
        console.warn("[App] boot error", error);
        if (mounted) setOnboardingSeen(false);
      } finally {
        if (!mounted) return;

        setBooting(false);
        splashTimer = setTimeout(() => {
          if (mounted) setShowSplash(false);
        }, 1600);
        console.log("[BOOT] booting finished");
      }
    }

    boot();

    return () => {
      mounted = false;
      if (splashTimer) clearTimeout(splashTimer);
    };
  }, [hydrate]);

  const finishOnboarding = useCallback(async () => {
    await markOnboardingSeen();
    setOnboardingSeen(true);
  }, []);

  const isLogged = !!token && !!role;
  const shouldShowSplash = booting || showSplash;

  return (
    <SafeAreaProvider>
      {shouldShowSplash ? (
        <DularSplashScreen />
      ) : (
        <NavigationContainer theme={navTheme} ref={navRef}>
          {isLogged ? (
            role === "DIARISTA" ? (
              <DiaristaTabs onLogout={clearSession} />
            ) : (
              <ClienteTabs onLogout={clearSession} />
            )
          ) : onboardingSeen === false ? (
            <OnboardingScreen onFinish={finishOnboarding} showSplash={false} />
          ) : (
            <AuthStack />
          )}
        </NavigationContainer>
      )}
      <StatusBar style={shouldShowSplash ? "light" : "dark"} />
    </SafeAreaProvider>
  );
}
