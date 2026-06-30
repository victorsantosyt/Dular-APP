/**
 * navHelpers — navegação para uma ABA a partir de QUALQUER tela.
 *
 * Pós #103 (stack-over-tabs), as abas vivem dentro de um navigator aninhado
 * (`EmpregadorTabs` / `DiaristaTabs` / `MontadorTabs`). Telas de stack (detalhe,
 * perfil, etc.) não conseguem `navigate("Perfil")` por nome puro — o React
 * Navigation não busca para dentro de navigators filhos. Use `goToTab` para
 * alcançar a aba via o container correto (`navigate(Tabs, { screen, params })`).
 */
type AnyNav = { navigate: (name: any, params?: any) => void };

export type TabsRoute = "EmpregadorTabs" | "DiaristaTabs" | "MontadorTabs";

export function goToTab(
  navigation: AnyNav,
  tabs: TabsRoute,
  screen: string,
  params?: Record<string, unknown>,
) {
  navigation.navigate(tabs, { screen, params });
}
