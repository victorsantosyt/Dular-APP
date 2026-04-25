import { NavigationContainer, DefaultTheme, Theme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo } from "react";
import ClienteTabs from "@/navigation/ClienteTabs";
import DiaristaTabs from "@/navigation/DiaristaTabs";
import AuthStack from "@/navigation/AuthStack";
import { colors } from "@/theme/tokens";
import { navRef } from "@/navigation/nav";
import { useAuth } from "@/stores/authStore";

export default function App() {
  const { token, role, hydrated, clearSession, hydrate } = useAuth();

  const navTheme: Theme = useMemo(() => {
    return {
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        primary: colors.primary,
        background: colors.bg,
        card: colors.card,
        text: colors.text,
        border: colors.border,
        notification: colors.primary,
      },
    };
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const isLogged = !!token && !!role;

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme} ref={navRef}>
        {!hydrated ? null : isLogged ? (
          role === "DIARISTA" ? (
            <DiaristaTabs onLogout={clearSession} />
          ) : (
            <ClienteTabs onLogout={clearSession} />
          )
        ) : (
          <AuthStack />
        )}
      </NavigationContainer>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
