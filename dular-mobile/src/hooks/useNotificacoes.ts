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
 * Consome GET /api/notificacoes. Mutações otimistas (marcar uma/todas como lidas).
 *
 * IMPORTANTE: usado por múltiplas telas (EmpregadorPerfil, NotificacoesEmpregador,
 * MontadorNotificacoes...). Cache + dedupe de módulo (singleton) garante uma única
 * request por janela de STALE_MS mesmo com vários consumidores simultâneos.
 */

const STALE_MS = 15000;
let cachedList: Notificacao[] | null = null;
let cachedAt = 0;
let cachedError: string | null = null;
let pendingPromise: Promise<{ list: Notificacao[]; error: string | null }> | null = null;
const subscribers = new Set<() => void>();

function notifyAll() {
  subscribers.forEach((cb) => {
    try { cb(); } catch {}
  });
}

async function fetchSharedNotificacoes(force = false): Promise<{ list: Notificacao[]; error: string | null }> {
  if (pendingPromise) return pendingPromise;
  if (!force && cachedList && Date.now() - cachedAt < STALE_MS) {
    return { list: cachedList, error: cachedError };
  }

  pendingPromise = (async () => {
    try {
      const list = await listarNotificacoes();
      cachedList = list;
      cachedError = null;
      cachedAt = Date.now();
      return { list, error: null };
    } catch (err) {
      cachedList = cachedList ?? [];
      cachedError = err instanceof Error ? err.message : "Falha ao carregar notificações.";
      cachedAt = Date.now();
      return { list: cachedList, error: cachedError };
    } finally {
      pendingPromise = null;
      notifyAll();
    }
  })();

  return pendingPromise;
}

/** Atualiza cache local sem refazer fetch (usado em mutações otimistas) */
function patchCache(updater: (list: Notificacao[]) => Notificacao[]) {
  cachedList = updater(cachedList ?? []);
  notifyAll();
}

export function useNotificacoes(): UseNotificacoesReturn {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>(cachedList ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(cachedError);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const sync = () => {
      if (!mountedRef.current) return;
      setNotificacoes(cachedList ?? []);
      setError(cachedError);
    };
    subscribers.add(sync);
    return () => {
      mountedRef.current = false;
      subscribers.delete(sync);
    };
  }, []);

  const triggerFetch = useCallback(async (force = false) => {
    if (mountedRef.current) setLoading(true);
    const result = await fetchSharedNotificacoes(force);
    if (!mountedRef.current) return;
    setNotificacoes(result.list);
    setError(result.error);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void triggerFetch(false);
    }, [triggerFetch]),
  );

  const refetch = useCallback(() => {
    void triggerFetch(true);
  }, [triggerFetch]);

  const marcarComoLida = useCallback(async (id: string) => {
    const nowIso = new Date().toISOString();
    // optimistic: atualiza cache compartilhado → notifica todos os consumidores
    patchCache((list) =>
      list.map((item) => (item.id === id && !item.readAt ? { ...item, readAt: nowIso } : item)),
    );
    try {
      await apiMarcarComoLida(id);
    } catch {
      void triggerFetch(true);
    }
  }, [triggerFetch]);

  const marcarTodasComoLidas = useCallback(async () => {
    const nowIso = new Date().toISOString();
    patchCache((list) =>
      list.map((item) => (item.readAt ? item : { ...item, readAt: nowIso })),
    );
    try {
      await apiMarcarTodasComoLidas();
    } catch {
      void triggerFetch(true);
    }
  }, [triggerFetch]);

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
