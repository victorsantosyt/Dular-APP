import { NavigationContainer, DefaultTheme, Theme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo } from "react";
import ClienteTabs from "./src/navigation/ClienteTabs";
import DiaristaTabs from "./src/navigation/DiaristaTabs";
import AuthScreen from "./src/screens/AuthScreen";
import { colors } from "./src/theme/theme";
import { navRef } from "./src/navigation/nav";
import { useAuth } from "./src/stores/authStore";

export default function App() {
  const { token, role, user, hydrated, setSession, clearSession, hydrate } = useAuth();

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
          <AuthScreen
            onAuth={(data) =>
              setSession({
                token: data.token,
                role: data.role,
                user: data.user ?? user,
              })
            }
          />
        )}
      </NavigationContainer>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
