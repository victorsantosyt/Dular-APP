export const radius = {
  xs: 8,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 28,
  pill: 999,

  // Compatibility aliases for older components.
  full: 999,
  btn: 18,
  tabbar: 28,
} as const;

// Alias for spec conformance — same values, alternative name.
export const borderRadius = radius;

/**
 * Raio de um botão preenchido.
 *
 * Existe porque o valor é usado em DOIS lugares que precisam concordar: o
 * preenchimento do botão e o wrapper que carrega a sombra. No Android a
 * `elevation` é recortada pelo `borderRadius` do View que a declara, então um
 * raio maior no wrapper deixa as quatro quinas do botão para fora da silhueta
 * da sombra.
 *
 * Foi o que aconteceu: o wrapper estava fixo em `pill` e o preenchimento
 * `flat` em `lg`. Medido no APK v25, botão "Salvar área" de 115 px de altura —
 * preenchimento com raio ~47 px contra sombra com ~57 px.
 *
 * Os ~10 px são a diferença entre os RAIOS, não o tamanho do defeito. Dois
 * arcos tangentes às mesmas arestas se afastam no máximo `(R-r)·(1-1/√2)` na
 * diagonal, ou seja ~2,9 px — e foi isso que apareceu na tela: o halo da
 * sombra media ~1 px no canto contra ~2-3 px no meio da aresta, e a quina do
 * botão encostava no fundo sem sombra atrás.
 *
 * Depois da correção, medido no APK v26 nos três sheets da diarista, o halo
 * do canto subiu de ~1 px para ~4 px, com o preenchimento inalterado.
 */
export function raioDoBotao(flat?: boolean): number {
  return flat ? radius.lg : radius.pill;
}
