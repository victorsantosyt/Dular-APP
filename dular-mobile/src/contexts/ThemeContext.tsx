/**
 * ThemeScope — provider de escopo de tema.
 *
 * Permite forçar o tema claro em sub-árvores específicas (onboarding, splash,
 * login) independente do que está salvo no useThemeStore. Fora de qualquer
 * Provider, o default `forceLight: false` mantém o comportamento antigo
 * (segue o store).
 */
import React, { createContext, useContext, useMemo } from "react";

type ThemeScopeValue = {
  forceLight: boolean;
};

const ThemeScopeContext = createContext<ThemeScopeValue>({ forceLight: false });

type Props = {
  children: React.ReactNode;
  forceLight?: boolean;
};

export function ThemeScope({ children, forceLight = false }: Props) {
  const value = useMemo(() => ({ forceLight }), [forceLight]);
  return <ThemeScopeContext.Provider value={value}>{children}</ThemeScopeContext.Provider>;
}

export function useThemeScope() {
  return useContext(ThemeScopeContext);
}
