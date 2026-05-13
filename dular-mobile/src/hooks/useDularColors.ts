import { colors } from "@/theme";
import { darkColors } from "@/theme/darkColors";
import { useThemeStore } from "@/stores/useThemeStore";
import { useThemeScope } from "@/contexts/ThemeContext";

export function useDularColors() {
  const mode = useThemeStore((state) => state.mode);
  const { forceLight } = useThemeScope();

  if (forceLight || mode === "light") return colors;
  return darkColors;
}
