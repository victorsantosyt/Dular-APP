import { useMemo } from "react";
import { useAuth } from "@/stores/authStore";
import { getProfileTheme } from "@/theme/profileTheme";

export function useProfileTheme(roleFallback?: string | null) {
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
