import { useMemo } from "react";
import {
  useFonts,
  PlusJakartaSans_200ExtraLight,
  PlusJakartaSans_300Light,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { NavigationContainer, DefaultTheme, type Theme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as ExpoSplashScreen from "expo-splash-screen";
import { navRef } from "@/navigation/nav";
import RootNavigator from "@/navigation/RootNavigator";
import { NotificacaoPopup } from "@/components/ui/NotificacaoPopup";
import { colors } from "@/theme/tokens";
import { aplicarFonteGlobal } from "@/theme/fonte";

// Fora do componente: a interceptação é global e precisa valer antes do
// primeiro render de qualquer <Text>.
aplicarFonteGlobal();

// A splash nativa cobre fontes, sessão e decisão inicial de navegação. A
// liberação única fica no RootNavigator, quando esses estados são válidos.
void ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  // Todos os pesos, porque a tradução peso → arquivo em theme/fonte.ts pode
  // pedir qualquer um deles a partir de um `fontWeight` de qualquer tela.
  const [fontesCarregadas, erroNasFontes] = useFonts({
    PlusJakartaSans_200ExtraLight,
    PlusJakartaSans_300Light,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

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

  // Mesmo em erro de fonte, montar o RootNavigator permite encerrar a splash
  // e exibir a recuperação de bootstrap em vez de deixar a tela nativa presa.
  const fontesProntas = fontesCarregadas || Boolean(erroNasFontes);

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme} ref={navRef}>
        <RootNavigator fontsReady={fontesProntas} />
        {/* Dentro do NavigationContainer (usa navRef para abrir a tela ao
            toque) e depois do navegador, para ficar por cima de tudo. */}
        <NotificacaoPopup />
      </NavigationContainer>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
