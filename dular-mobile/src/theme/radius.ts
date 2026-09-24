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
 * preenchimento com raio ~47 px contra sombra com ~57 px, ~10 px de quina
 * descoberta em cada canto.
 */
export function raioDoBotao(flat?: boolean): number {
  return flat ? radius.lg : radius.pill;
}
