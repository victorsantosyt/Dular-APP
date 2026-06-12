import { useMemo } from "react";
import { useAuth } from "@/stores/authStore";
import { getProfileTheme, type ProfileTheme } from "@/theme/profileTheme";

/**
 * useGenderTheme — fonte ÚNICA de verdade visual por gênero.
 *
 * FASE 4: o gênero vem EXCLUSIVAMENTE de `user.genero` (atributo de conta,
 * persistido pelo backend via GET /api/me e cacheado em SecureStorage/
 * AsyncStorage, re-hidratado no boot). NÃO há fallback para o gênero
 * temporário do onboarding — o backend é a única fonte.
 *
 * Mapeamento (ver theme/profileTheme.ts):
 *   FEMININO   → paleta Rosa
 *   MASCULINO  → paleta Verde
 *   EMPREGADOR (sem gênero passado) → Roxo
 *   sem gênero (não-empregador)     → NEUTRAL_THEME (nunca infere gênero por role)
 *
 * @param roleFallback usado só para distinguir EMPREGADOR enquanto `user.role`
 *   não carregou; não influencia a cor de gênero.
 */
export function useGenderTheme(roleFallback?: string | null): ProfileTheme {
  const user = useAuth((state) => state.user);
  const selectedRole = useAuth((state) => state.selectedRole);

  return useMemo(
    () =>
      getProfileTheme({
        role: user?.role ?? selectedRole ?? roleFallback,
        genero: user?.genero,
      }),
    [roleFallback, selectedRole, user?.genero, user?.role],
  );
}

/** useProfileTheme — alias histórico de useGenderTheme (mesma fonte única). */
export const useProfileTheme = useGenderTheme;
