const MIN_BOTTOM_NAV_GAP = 8;

/**
 * Mantém a barra acima da área de gesto sem descartar parte do inset informado
 * pelo sistema. Em aparelhos sem inset inferior, preserva somente o respiro
 * visual mínimo do componente flutuante.
 */
export function getBottomNavSafeAreaPadding(bottomInset: number): number {
  return Math.max(bottomInset, MIN_BOTTOM_NAV_GAP);
}

/**
 * Soma o espaço ocupado pela tab bar medida pelo navigator ao respiro próprio
 * do conteúdo. A altura da barra não é estimada: vem do onLayout real.
 */
export function getBottomNavContentPadding(
  tabBarHeight: number,
  contentPadding = 0,
): number {
  return Math.max(tabBarHeight, 0) + Math.max(contentPadding, 0);
}
