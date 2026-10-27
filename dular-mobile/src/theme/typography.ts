import { Dimensions, PixelRatio } from "react-native";
import { criarTipografia } from "./escalaTipografica";

export { LARGURA_BASE, criarTipografia } from "./escalaTipografica";

/** Tokens para uma largura de janela, arredondados ao pixel do aparelho. */
export function tipografiaPara(largura: number) {
  return criarTipografia(largura, PixelRatio.roundToNearestPixel);
}

/**
 * Fotografia da largura na carga do módulo, para os StyleSheets estáticos.
 * Tela que precisa acompanhar mudança de largura com o app aberto usa
 * `useTipografia()`.
 */
export const typography = tipografiaPara(Dimensions.get("window").width);
