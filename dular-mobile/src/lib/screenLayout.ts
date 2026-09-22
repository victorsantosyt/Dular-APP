/**
 * Espaço que o fim do conteúdo precisa reservar para não terminar embaixo da
 * barra inferior — a do sistema, num Stack, ou a BottomNav, numa aba.
 *
 * O defeito que isto corrige: `Screen` e `DScreen` fechavam o conteúdo com um
 * respiro fixo (`spacing.xl`, 28) e deixavam `"bottom"` fora dos `edges` do
 * SafeAreaView. Num Android de três botões o inset inferior é ~126px, então o
 * último item de qualquer tela longa passava por baixo dos controles — texto
 * cortado em ExcluirConta, e o "Acionar SOS (190)" inalcançável em
 * MontadorDetalheServico.
 *
 * As duas situações NÃO usam a mesma conta, e é isso que a função separa:
 *
 *  - **Stack**: nada cobre o rodapé além da barra do sistema, então o conteúdo
 *    soma o inset ao próprio respiro.
 *  - **Aba**: a BottomNav já está ali, e a altura que ela publica pelo
 *    `onLayout` JÁ INCLUI o inset do sistema — ela desenha por cima dele. Somar
 *    `systemInset` de novo empilharia o mesmo espaço duas vezes e abriria um
 *    vão de mais de cem pixels no fim da lista.
 *
 * Quem distingue os dois é o próprio React Navigation: fora de uma aba não há
 * `BottomTabBarHeightContext`, e o chamador passa 0. Não há detecção por nome
 * de rota, perfil ou plataforma.
 */
export function getScrollBottomClearance(params: {
  /** Respiro visual que a tela já definia; é preservado, nunca substituído. */
  basePadding: number;
  /** `useSafeAreaInsets().bottom` — a barra do sistema. */
  systemInset: number;
  /** Altura medida da BottomNav, ou 0 quando a tela não está numa aba. */
  bottomTabBarHeight: number;
}): number {
  const base = Math.max(params.basePadding, 0);
  const tabBar = Math.max(params.bottomTabBarHeight, 0);

  // Durante o primeiro layout a barra ainda não mediu e publica 0. Cair no
  // ramo do Stack nesse instante é o certo: reserva o inset do sistema, que
  // é o mínimo correto, e o valor sobe para a altura real assim que ela chega.
  if (tabBar > 0) return base + tabBar;

  return base + Math.max(params.systemInset, 0);
}
