import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  listarNotificacoes,
  marcarComoLida as apiMarcarComoLida,
  marcarTodasComoLidas as apiMarcarTodasComoLidas,
  type Notificacao,
} from "@/api/notificacoesApi";
import { criarCacheCompartilhado } from "@/lib/cacheCompartilhado";
import { sessaoAtual } from "@/lib/sessaoAtual";

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

const cacheNotificacoes = criarCacheCompartilhado<Notificacao[]>({
  staleMs: STALE_MS,
  vazio: () => [],
  mensagemDeErro: (err) => (err instanceof Error ? err.message : "Falha ao carregar notificações."),
  chaveSessao: sessaoAtual,
  buscar: (signal) => listarNotificacoes(signal),
});

/** Chegou aviso com o app aberto: o sino atualiza sem esperar os 15 s. */
export function invalidarNotificacoes(): void {
  cacheNotificacoes.invalidar();
}

/** Troca de conta: os avisos da conta anterior não podem aparecer na próxima. */
export function limparCacheNotificacoes(): void {
  cacheNotificacoes.limpar();
}

export function useNotificacoes(): UseNotificacoesReturn {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>(cacheNotificacoes.atual().valor ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(cacheNotificacoes.atual().erro);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const cancelar = cacheNotificacoes.assinar(() => {
      if (!mountedRef.current) return;
      const { valor, erro } = cacheNotificacoes.atual();
      setNotificacoes(valor ?? []);
      setError(erro);
    });
    return () => {
      mountedRef.current = false;
      cancelar();
    };
  }, []);

  const triggerFetch = useCallback(async (force = false) => {
    if (mountedRef.current) setLoading(true);
    const result = await cacheNotificacoes.obter(force);
    if (!mountedRef.current) return;
    setNotificacoes(result.valor);
    setError(result.erro);
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
    cacheNotificacoes.alterar((list) =>
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
    cacheNotificacoes.alterar((list) =>
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
