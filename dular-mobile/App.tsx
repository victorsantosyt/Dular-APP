import { useMemo } from "react";
import { NavigationContainer, DefaultTheme, type Theme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { navRef } from "@/navigation/nav";
import RootNavigator from "@/navigation/RootNavigator";
import { colors } from "@/theme/tokens";

export default function App() {
  const navTheme: Theme = useMemo(
    () => ({
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
    }),
    [],
  );

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme} ref={navRef}>
        <RootNavigator />
      </NavigationContainer>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
