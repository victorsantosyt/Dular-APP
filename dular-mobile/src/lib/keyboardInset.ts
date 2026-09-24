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

/**
 * Deslocamento externo de um modal ancorado no rodapé.
 *
 * Fechado, o modal sai da região protegida pelo sistema. Com o IME aberto, a
 * oclusão medida já inclui essa região, portanto os valores nunca são somados.
 * O respiro visual pertence ao conteúdo do modal e deve ser aplicado uma única
 * vez dentro dele.
 */
export function calcularDeslocamentoInferiorModal(
  safeAreaInset: number,
  imeInset: number,
): number {
  const safe = Number.isFinite(safeAreaInset) ? Math.max(safeAreaInset, 0) : 0;
  const ime = Number.isFinite(imeInset) ? Math.max(imeInset, 0) : 0;
  return ime > 0 ? ime : safe;
}

/**
 * Respiro visual entre o último elemento do modal e a borda inferior dele.
 *
 * É o `spacing.xl` das telas que passaram em QA físico (`PerfilPublicoLayout`,
 * `FlowFooter`). Antes valia `spacing.md`, e o APK v24 mediu o resultado: 12,19
 * a 13,33 dp de folga visível entre o CTA e a barra do sistema, nos três sheets
 * e nos dois modos de navegação.
 */
export const RESPIRO_INTERNO_MODAL = 24;

/**
 * Padding inferior de um modal ancorado no rodapé.
 *
 * Quem já reservou a região do sistema decide a conta, e é por isso que o
 * parâmetro existe:
 *
 *  - `insetJaReservadoFora: true` — o overlay aplicou o deslocamento (é o caso
 *    do Android depois de `calcularDeslocamentoInferiorModal`). O sheet só
 *    carrega o respiro, e ele aparece inteiro na tela.
 *  - `insetJaReservadoFora: false` — ninguém reservou nada fora (iOS, onde o
 *    overlay fica em zero e o `behavior="padding"` cuida do teclado). O sheet
 *    cobre a região do sistema e ainda soma o respiro.
 *
 * O erro que isto substitui era `Math.max(inset, respiro) + respiro`: o `max`
 * engolia o inset sempre que ele passava do piso — 48 dp em três botões, 14,9
 * em gestos, ambos maiores que 12 — e o que sobrava de folga visível era só o
 * segundo termo. A folga não pode depender do inset; ela é do design.
 */
export function calcularPaddingInternoModal(params: {
  safeAreaInset: number;
  insetJaReservadoFora: boolean;
  respiro?: number;
}): number {
  const respiro = Number.isFinite(params.respiro ?? NaN)
    ? Math.max(params.respiro as number, 0)
    : RESPIRO_INTERNO_MODAL;
  if (params.insetJaReservadoFora) return respiro;
  const inset = Number.isFinite(params.safeAreaInset) ? Math.max(params.safeAreaInset, 0) : 0;
  return inset + respiro;
}
