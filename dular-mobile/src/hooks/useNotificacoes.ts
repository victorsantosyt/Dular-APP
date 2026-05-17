import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  listarNotificacoes,
  marcarComoLida as apiMarcarComoLida,
  marcarTodasComoLidas as apiMarcarTodasComoLidas,
  type Notificacao,
} from "@/api/notificacoesApi";

export interface UseNotificacoesReturn {
  notificacoes: Notificacao[];
  loading: boolean;
  error: string | null;
  unreadCount: number;
  refetch: () => void;
  marcarComoLida: (id: string) => Promise<void>;
  marcarTodasComoLidas: () => Promise<void>;
}

/**
 * Hook de notificações in-app.
 *
 * Consome GET /api/notificacoes. As mutações em PATCH /api/notificacoes/[id]/ler
 * e PATCH /api/notificacoes/ler-todas usam optimistic update e re-buscam apenas
 * em caso de erro real.
 *
 * Proteções:
 * - `inFlight` evita reentrância em foco/refetch
 * - `mountedRef` evita setState após unmount
 * - `useFocusEffect` re-busca apenas quando a tela ganha foco
 */
export function useNotificacoes(): UseNotificacoesReturn {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetch = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (mountedRef.current) setLoading(true);
    try {
      const list = await listarNotificacoes();
      if (mountedRef.current) {
        setNotificacoes(list);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setNotificacoes([]);
        setError(err instanceof Error ? err.message : "Falha ao carregar notificações.");
      }
    } finally {
      inFlight.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void fetch();
    }, [fetch]),
  );

  const refetch = useCallback(() => {
    void fetch();
  }, [fetch]);

  const marcarComoLida = useCallback(async (id: string) => {
    // optimistic update
    const nowIso = new Date().toISOString();
    setNotificacoes((current) =>
      current.map((item) => (item.id === id && !item.readAt ? { ...item, readAt: nowIso } : item)),
    );
    try {
      await apiMarcarComoLida(id);
    } catch {
      // rollback em caso de erro real
      void fetch();
    }
  }, [fetch]);

  const marcarTodasComoLidas = useCallback(async () => {
    const nowIso = new Date().toISOString();
    setNotificacoes((current) =>
      current.map((item) => (item.readAt ? item : { ...item, readAt: nowIso })),
    );
    try {
      await apiMarcarTodasComoLidas();
    } catch {
      void fetch();
    }
  }, [fetch]);

  const unreadCount = useMemo(
    () => notificacoes.reduce((total, item) => (item.readAt ? total : total + 1), 0),
    [notificacoes],
  );

  return {
    notificacoes,
    loading,
    error,
    unreadCount,
    refetch,
    marcarComoLida,
    marcarTodasComoLidas,
  };
}
