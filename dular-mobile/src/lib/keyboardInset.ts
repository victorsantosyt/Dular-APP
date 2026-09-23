/**
 * Quanto da árvore precisa sair do caminho quando o teclado abre no Android.
 *
 * Por que isto existe: o app é edge-to-edge, então a janela NÃO encolhe quando
 * o IME aparece — ele chega como inset e desenha por cima. O
 * `KeyboardAvoidingView` com `behavior="height"` parecia resolver, mas mediu-se
 * no aparelho (v19) que ele não volta ao tamanho original quando o teclado
 * fecha: o payload de `keyboardDidHide` do Android traz
 * `mVisibleViewArea.height()` em `screenY`, enquanto o de `keyboardDidShow`
 * traz `mVisibleViewArea.bottom`. Como o componente recalcula a redução em vez
 * de zerá-la no hide, sobra exatamente `insetTop + insetBottom` — 78,1dp em três
 * botões e 45,0dp em gestos, no mesmo aparelho.
 *
 * A saída é não depender do estado interno do componente: o `keyboardDidShow`
 * informa o topo físico do teclado e a conta é feita aqui.
 *
 * E é `screenY`, não `endCoordinates.height`: numa árvore edge-to-edge que vai
 * até a borda física, `height` cobre só o teclado e deixa a barra de navegação
 * de fora. No v19, `screen.height - screenY` deu 377,5dp enquanto `height` deu
 * 329,5dp — a diferença de 48dp é justamente a barra, e era ela que faltava.
 *
 * @param screenHeight  `Dimensions.get("screen").height` LIDO NO EVENTO.
 * @param keyboardScreenY `endCoordinates.screenY` — topo do teclado na tela.
 * @returns oclusão em dp; 0 quando o dado não serve (nunca um chute de altura).
 */
export function calcularImeInsetAndroid(
  screenHeight: number,
  keyboardScreenY?: number | null,
): number {
  if (!Number.isFinite(screenHeight) || screenHeight <= 0) return 0;
  if (keyboardScreenY == null || !Number.isFinite(keyboardScreenY)) return 0;

  // Topo negativo ou além da borda inferior não descreve teclado nenhum.
  // Falhar em zero deixa a tela como se o teclado estivesse fechado, que é o
  // estado seguro: nada some. Inventar uma altura fixa seria o contrário.
  if (keyboardScreenY < 0 || keyboardScreenY >= screenHeight) return 0;

  return screenHeight - keyboardScreenY;
}
