import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "@/lib/api";

export interface ChatRoom {
  id: string;
  servicoId: string;
  /** true quando o serviço foi finalizado (CONCLUIDO/CONFIRMADO/FINALIZADO).
   *  Chat fica somente leitura e aparece na aba "Arquivadas". */
  arquivada: boolean;
  outroUsuario: {
    id: string;
    nome: string;
    avatarUrl?: string | null;
  };
  servico?: {
    id?: string;
    status?: string | null;
    tipo?: string | null;
    data?: string | null;
    local?: string | null;
  };
  ultimaMensagem?: {
    texto: string;
    criadaEm: string;
    lida: boolean;
  };
  naoLidas: number;
  atualizadaEm: string;
}

export interface UseMensagensReturn {
  rooms: ChatRoom[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

type RawRoom = {
  id: string;
  servicoId: string;
  createdAt?: string;
  atualizadaEm?: string;
  arquivada?: boolean;
  outroUsuario?: {
    id?: string;
    nome?: string | null;
    avatarUrl?: string | null;
  } | null;
  servico?: {
    id?: string;
    status?: string | null;
    tipo?: string | null;
    data?: string | null;
    local?: string | null;
  } | null;
  naoLidas?: number | null;
  ultimaMensagem?: {
    texto?: string;
    criadaEm?: string;
    lida?: boolean;
  } | null;
};

const STATUS_ARQUIVADOS_FALLBACK = new Set(["CONCLUIDO", "CONFIRMADO", "FINALIZADO"]);

function normalizeRoom(raw: RawRoom): ChatRoom {
  const outro = raw.outroUsuario ?? {};
  const statusUp = String(raw.servico?.status ?? "").toUpperCase();
  // Backend nova versão envia `arquivada`. Fallback p/ inferir via status caso
  // o app rode contra um backend antigo (não derruba a UI).
  const arquivada =
    typeof raw.arquivada === "boolean" ? raw.arquivada : STATUS_ARQUIVADOS_FALLBACK.has(statusUp);
  return {
    id: raw.id,
    servicoId: raw.servicoId,
    arquivada,
    outroUsuario: {
      id: outro.id ?? "",
      nome: outro.nome ?? "Contato",
      avatarUrl: outro.avatarUrl ?? null,
    },
    servico: raw.servico
      ? {
          id: raw.servico.id,
          status: raw.servico.status ?? null,
          tipo: raw.servico.tipo ?? null,
          data: raw.servico.data ?? null,
          local: raw.servico.local ?? null,
        }
      : undefined,
    ultimaMensagem: raw.ultimaMensagem?.texto
      ? {
          texto: raw.ultimaMensagem.texto,
          criadaEm: raw.ultimaMensagem.criadaEm ?? raw.createdAt ?? "",
          lida: Boolean(raw.ultimaMensagem.lida),
        }
      : undefined,
    naoLidas: Math.max(0, Number(raw.naoLidas) || 0),
    atualizadaEm: raw.atualizadaEm ?? raw.createdAt ?? new Date().toISOString(),
  };
}

/**
 * Consumidor de GET /api/chat — lista as salas do usuário autenticado.
 *
 * IMPORTANTE: este hook é usado em 5+ telas que ficam montadas simultaneamente
 * (Home, Mensagens, Agendamentos, etc.) no bottom tab navigator. Sem dedupe
 * global, cada mount dispara seu próprio GET /api/chat em paralelo, saturando
 * o pool de conexões do backend (timeouts de 20s nos logs).
 *
 * Solução: cache + dedupe de módulo (singleton). Uma única request por janela
 * de STALE_MS é compartilhada por todas as instâncias do hook. `refetch()`
 * sempre invalida o cache (fluxo manual de pull-to-refresh).
 */

const STALE_MS = 15000; // 15s — janela em que cache é considerado fresco
let cachedRooms: ChatRoom[] | null = null;
let cachedAt = 0;
let cachedError: string | null = null;
let pendingPromise: Promise<{ rooms: ChatRoom[]; error: string | null }> | null = null;
const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach((cb) => {
    try { cb(); } catch {}
  });
}

async function fetchRoomsShared(force = false): Promise<{ rooms: ChatRoom[]; error: string | null }> {
  // Dedupe: se já há request em voo, todos esperam a mesma
  if (pendingPromise) return pendingPromise;
  // Cache fresco e não forçado: retorna imediato
  if (!force && cachedRooms && Date.now() - cachedAt < STALE_MS) {
    return { rooms: cachedRooms, error: cachedError };
  }

  pendingPromise = (async () => {
    try {
      const res = await api.get<{ ok?: boolean; rooms?: RawRoom[] }>("/api/chat");
      const rawList = Array.isArray(res.data?.rooms) ? res.data.rooms : [];
      const normalized = rawList.map(normalizeRoom);
      cachedRooms = normalized;
      cachedError = null;
      cachedAt = Date.now();
      return { rooms: normalized, error: null };
    } catch (err) {
      cachedRooms = cachedRooms ?? [];
      cachedError = err instanceof Error ? err.message : "Falha ao carregar conversas.";
      cachedAt = Date.now();
      return { rooms: cachedRooms, error: cachedError };
    } finally {
      pendingPromise = null;
      notifySubscribers();
    }
  })();

  return pendingPromise;
}

export function useMensagens(): UseMensagensReturn {
  const [rooms, setRooms] = useState<ChatRoom[]>(cachedRooms ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(cachedError);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    // Inscreve-se em atualizações do cache (qualquer instance fetcha → todas atualizam)
    const sync = () => {
      if (!mountedRef.current) return;
      setRooms(cachedRooms ?? []);
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
    const result = await fetchRoomsShared(force);
    if (!mountedRef.current) return;
    setRooms(result.rooms);
    setError(result.error);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Foco re-fetcha respeitando cache (dedupe). Se cache fresco, no-op.
      void triggerFetch(false);
    }, [triggerFetch]),
  );

  const refetch = useCallback(() => {
    void triggerFetch(true); // pull-to-refresh: força revalidação
  }, [triggerFetch]);

  return { rooms, loading, error, refetch };
}
