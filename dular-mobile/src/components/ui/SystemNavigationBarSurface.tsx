import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDularColors } from "@/hooks/useDularColors";

/**
 * Superfície própria sob a barra de navegação NATIVA do Android.
 *
 * Não confundir com a `DBottomNav`: esta não desenha botão nenhum e não tem
 * geometria própria. Ela só pinta a faixa que o sistema reserva para os
 * controles dele — os três botões ou a barra de gestos.
 *
 * Por que precisa existir. Com edge-to-edge, que o Android 16 (targetSdk 36)
 * tornou obrigatório, a barra de navegação é SEMPRE transparente: o tema do
 * app recebe `android:navigationBarColor = @android:color/transparent` e, da
 * API 29 em diante, não há mais API para pintá-la de uma cor sólida. O que o
 * sistema oferece é `enforceNavigationBarContrast`, um véu translúcido — e era
 * ele que deixava o conteúdo do app aparecendo esmaecido atrás dos controles.
 *
 * Chrome e Drive não pintam a barra do sistema: eles desenham a própria
 * superfície até a borda inferior da tela, e o que se vê atrás dos controles é
 * essa superfície, não conteúdo rolando. É o que este componente faz.
 *
 * Não altera a geometria de tela nenhuma: é `position: absolute` sobre a área
 * que o `useSafeAreaInsets` já reservava, e `pointerEvents="none"` para não
 * capturar toque. As telas continuam com o mesmo padding de antes.
 *
 * A cor vem de `useDularColors`, o mesmo hook que o resto do app usa, para não
 * haver uma segunda definição de tema. Hoje ele devolve sempre o tema claro —
 * `useThemeStore` está fixado em "light" enquanto o dark mode não volta —, e
 * quando voltar esta faixa acompanha sem alteração aqui.
 *
 * Só Android: no iOS não existe barra de navegação do sistema para cobrir, e o
 * inset inferior é o home indicator, que deve continuar sobre o conteúdo.
 */
export function SystemNavigationBarSurface() {
  const insets = useSafeAreaInsets();
  const colors = useDularColors();

  // `insets.bottom` é zero em aparelho sem barra inferior; sem altura não há o
  // que cobrir, e uma View de altura zero só gastaria render.
  if (Platform.OS !== "android" || insets.bottom <= 0) return null;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.superficie,
        { height: insets.bottom, backgroundColor: colors.background },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  superficie: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
});
