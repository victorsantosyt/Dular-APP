import { useCallback, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/stores/authStore";
import { useAoMudarConta } from "@/hooks/useSincronizacaoConta";
import type { Assunto } from "@/lib/sincronizacaoConta";

export type SafeScoreResource<T> = { loading: boolean; data: T | null; error: boolean; retry: () => void };

/**
 * `assuntos`: o recurso relê, sem limpar o que já está na tela, quando a
 * sincronização confirma mudança num deles (ex.: SafeScore recalculado,
 * verificação aprovada no painel).
 */
export function useSafeScoreResource<T>(fetcher: () => Promise<T>, assuntos: readonly Assunto[] = []): SafeScoreResource<T> {
  const userId = useAuth(s => s.user?.id);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ loading: true, data: null as T | null, error: false });
  const manterDados = useRef(false);
  useAoMudarConta(assuntos, () => {
    manterDados.current = true;
    setRevision(value => value + 1);
  });
  useFocusEffect(useCallback(() => {
    let active = true;
    let request = 0;
    const load = async (silencioso: boolean) => {
      const current = ++request;
      if (!silencioso) setState({ loading: true, data: null, error: false });
      try {
        if (!userId) throw new Error("Sessão indisponível");
        const data = await fetcher();
        if (active && current === request) setState({ loading: false, data, error: false });
      } catch {
        // Releitura automática que falha mantém o dado já mostrado.
        if (active && current === request && !silencioso) setState({ loading: false, data: null, error: true });
      }
    };
    const silencioso = manterDados.current;
    manterDados.current = false;
    void load(silencioso);
    const subscription = AppState.addEventListener("change", next => { if (next === "active") void load(false); });
    return () => { active = false; subscription.remove(); };
  }, [fetcher, userId, revision]));
  return { ...state, retry: () => setRevision(value => value + 1) };
}
