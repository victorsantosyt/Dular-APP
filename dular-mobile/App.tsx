import { useMemo } from "react";
import { View } from "react-native";
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
import { navRef } from "@/navigation/nav";
import RootNavigator from "@/navigation/RootNavigator";
import { NotificacaoPopup } from "@/components/ui/NotificacaoPopup";
import { colors } from "@/theme/tokens";
import { aplicarFonteGlobal } from "@/theme/fonte";

// Fora do componente: a interceptação é global e precisa valer antes do
// primeiro render de qualquer <Text>.
aplicarFonteGlobal();

export default function App() {
  // Todos os pesos, porque a tradução peso → arquivo em theme/fonte.ts pode
  // pedir qualquer um deles a partir de um `fontWeight` de qualquer tela.
  const [fontesCarregadas] = useFonts({
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

  // Sem gate o app renderiza no fallback do sistema e "pula" para a fonte
  // certa quando ela chega — o texto salta de posição na cara do usuário.
  if (!fontesCarregadas) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme} ref={navRef}>
        <RootNavigator />
        {/* Dentro do NavigationContainer (usa navRef para abrir a tela ao
            toque) e depois do navegador, para ficar por cima de tudo. */}
        <NotificacaoPopup />
      </NavigationContainer>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
