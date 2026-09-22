import { colors } from "@/theme";
import { darkColors } from "@/theme/darkColors";
import { useThemeStore } from "@/stores/useThemeStore";
import { useThemeScope } from "@/contexts/ThemeContext";

export type ModoDeTema = "light" | "dark";

/**
 * Modo de tema EFETIVO — o do store, com o escopo podendo forçar claro.
 *
 * Existe para que quem precisa do modo em si, e não das cores, leia a mesma
 * decisão que `useDularColors` toma, em vez de inferir o tema pela cor
 * resolvida ou consultar o store por fora e divergir do escopo.
 */
export function useModoDeTema(): ModoDeTema {
  const mode = useThemeStore((state) => state.mode);
  const { forceLight } = useThemeScope();
  return forceLight || mode === "light" ? "light" : "dark";
}

export function useDularColors() {
  return useModoDeTema() === "light" ? colors : darkColors;
}
