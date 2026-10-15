import { useCallback, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/stores/authStore";

export type SafeScoreResource<T> = { loading: boolean; data: T | null; error: boolean; retry: () => void };

export function useSafeScoreResource<T>(fetcher: () => Promise<T>): SafeScoreResource<T> {
  const userId = useAuth(s => s.user?.id);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ loading: true, data: null as T | null, error: false });
  useFocusEffect(useCallback(() => {
    let active = true;
    let request = 0;
    const load = async () => {
      const current = ++request;
      setState({ loading: true, data: null, error: false });
      try {
        if (!userId) throw new Error("Sessão indisponível");
        const data = await fetcher();
        if (active && current === request) setState({ loading: false, data, error: false });
      } catch {
        if (active && current === request) setState({ loading: false, data: null, error: true });
      }
    };
    void load();
    const subscription = AppState.addEventListener("change", next => { if (next === "active") void load(); });
    return () => { active = false; subscription.remove(); };
  }, [fetcher, userId, revision]));
  return { ...state, retry: () => setRevision(value => value + 1) };
}
