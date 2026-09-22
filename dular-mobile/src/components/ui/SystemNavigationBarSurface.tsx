import { useEffect } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as NavigationBar from "expo-navigation-bar";

import { useDularColors, useModoDeTema } from "@/hooks/useDularColors";
import { estiloDaBarraPorTema } from "@/lib/systemNavigationBar";

/**
 * Superfície própria sob a barra de navegação NATIVA do Android, e a aparência
 * dos controles que o sistema desenha sobre ela.
 *
 * Não confundir com a `DBottomNav`: esta não desenha botão nenhum e não tem
 * geometria própria. Ela só cuida da faixa que o sistema reserva para os
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
 * Com o véu desligado, os controles perdem o fundo que o sistema lhes dava, e
 * quem precisa garantir o contraste passa a ser o app: daí o `setStyle`. O
 * atributo `barStyle` do app.json não dá conta — medido no v12, a janela
 * publicava `mAppearance=8`, ou seja, só `APPEARANCE_LIGHT_STATUS_BARS`,
 * nunca a flag equivalente da barra de navegação.
 *
 * Não altera a geometria de tela nenhuma: é `position: absolute` sobre a área
 * que o `useSafeAreaInsets` já reservava, e `pointerEvents="none"` para não
 * capturar toque. As telas continuam com o mesmo padding de antes.
 *
 * O tema vem de `useModoDeTema`, a mesma decisão que `useDularColors` usa para
 * escolher a paleta — uma fonte só. Hoje resolve sempre claro, porque o dark
 * mode segue desativado no store; quando voltar, superfície e controles
 * acompanham juntos, sem alteração aqui.
 *
 * Só Android: no iOS não existe barra de navegação do sistema para cobrir, e o
 * inset inferior é o home indicator, que deve continuar sobre o conteúdo.
 */
export function SystemNavigationBarSurface() {
  const insets = useSafeAreaInsets();
  const colors = useDularColors();
  const modo = useModoDeTema();

  useEffect(() => {
    if (Platform.OS !== "android") return;
    try {
      // Síncrona e barata; o efeito só roda quando o tema muda, não a cada
      // render. Envolvida porque uma falha aqui é cosmética e não pode
      // derrubar o app — em emulador de Android 15 a chamada é conhecida por
      // não ter efeito, e é melhor seguir sem contraste do que sem app.
      NavigationBar.setStyle(estiloDaBarraPorTema(modo));
    } catch {
      // sem contraste garantido; a superfície abaixo continua correta.
    }
  }, [modo]);

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
