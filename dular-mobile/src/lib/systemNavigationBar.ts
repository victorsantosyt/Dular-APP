import type { NavigationBarStyle } from "expo-navigation-bar";

import type { ModoDeTema } from "@/hooks/useDularColors";

/**
 * Traduz o tema do Dular para o estilo da barra de navegação do sistema.
 *
 * A semântica de `NavigationBar.setStyle` é a da BARRA, não a dos botões, e na
 * primeira leitura parece invertida: `"light"` significa barra clara — e, para
 * haver contraste, botões escuros. É o oposto de `setButtonStyleAsync`, que
 * nomeia os botões. Confirmado no código da lib: `setStyle("light")` chama
 * `setButtonStyleAsync("dark")`.
 *
 * Trocar os dois foi o defeito medido no APK v12: os controles ficaram claros
 * sobre superfície clara, a 1,38:1 de contraste. Por isso esta tradução mora
 * numa função própria, verificável sem aparelho.
 */
export function estiloDaBarraPorTema(modo: ModoDeTema): NavigationBarStyle {
  return modo === "dark" ? "dark" : "light";
}
