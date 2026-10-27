import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { tipografiaPara } from "@/theme/typography";

/**
 * Tokens tipográficos da largura ATUAL da janela. Recalcula quando a largura
 * muda com o app aberto (tamanho de exibição, janela dividida, dobrável).
 */
export function useTipografia() {
  const { width } = useWindowDimensions();
  return useMemo(() => tipografiaPara(width), [width]);
}
