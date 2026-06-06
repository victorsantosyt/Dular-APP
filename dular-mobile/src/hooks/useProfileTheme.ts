import { useMemo } from "react";
import { useAuth } from "@/stores/authStore";
import { getProfileTheme, type ProfileTheme } from "@/theme/profileTheme";

/**
 * useGenderTheme — fonte ÚNICA de verdade para a identidade visual por gênero.
 *
 * Lê o gênero/role já PERSISTIDO no authStore (nunca de estado temporário de
 * tela). A origem do gênero é o backend (`GET /api/me`), reconciliado e
 * persistido pelo authStore em:
 *   - SecureStorage (objeto `user` completo)
 *   - AsyncStorage (chave "genero")
 * e re-hidratado no boot (`authStore.hydrate`). Por isso o tema é reconstruído
 * de forma determinística sempre que qualquer tela monta — sobrevive a
 * reload/relogin sem depender de props ou de estado local.
 *
 * Mapeamento (ver theme/profileTheme.ts):
 *   FEMININO  → paleta Rosa
 *   MASCULINO → paleta Verde
 * Sem fallback aleatório: na ausência de gênero, cai no fallback determinístico
 * por role (DIARISTA→Rosa, MONTADOR→Verde, EMPREGADOR→Roxo).
 *
 * @param roleFallback role usada apenas quando user.role e selectedRole estão
 *   ausentes (ex.: tela aberta antes do /api/me responder).
 */
export function useGenderTheme(roleFallback?: string | null): ProfileTheme {
  const user = useAuth((state) => state.user);
  const selectedRole = useAuth((state) => state.selectedRole);
  const selectedGenero = useAuth((state) => state.selectedGenero);

  return useMemo(
    () =>
      getProfileTheme({
        role: user?.role ?? selectedRole ?? roleFallback,
        genero: user?.genero ?? selectedGenero,
      }),
    [roleFallback, selectedGenero, selectedRole, user?.genero, user?.role],
  );
}

/**
 * useProfileTheme — alias histórico de useGenderTheme.
 *
 * Mantido porque várias telas (fluxo Montador/Empregador) já o importam. Ambos
 * resolvem exatamente a mesma paleta a partir da mesma fonte persistida, então
 * não há lógica de cor duplicada espalhada pelas telas.
 */
export const useProfileTheme = useGenderTheme;
