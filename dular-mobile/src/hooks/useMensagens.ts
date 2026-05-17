import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "@/lib/api";

export interface ChatRoom {
  id: string;
  servicoId: string;
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

function normalizeRoom(raw: RawRoom): ChatRoom {
  const outro = raw.outroUsuario ?? {};
  return {
    id: raw.id,
    servicoId: raw.servicoId,
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
 * Backend devolve `{ ok: true, rooms: RawRoom[] }`. Os campos `naoLidas`,
 * `ultimaMensagem` e `atualizadaEm` ainda podem não vir preenchidos pelo
 * backend; nesse caso usamos defaults seguros (0 e `createdAt`) para
 * manter a UI estável.
 *
 * Proteções contra loop:
 * - `inFlight` evita reentrância em chamadas concorrentes
 * - `mountedRef` evita setState após unmount
 * - `useFocusEffect` re-busca apenas quando a tela ganha foco
 */
export function useMensagens(): UseMensagensReturn {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
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

  const fetchRooms = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (mountedRef.current) setLoading(true);
    try {
      const res = await api.get<{ ok?: boolean; rooms?: RawRoom[] }>("/api/chat");
      const rawList = Array.isArray(res.data?.rooms) ? res.data.rooms : [];
      const normalized = rawList.map(normalizeRoom);
      if (mountedRef.current) {
        setRooms(normalized);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setRooms([]);
        setError(err instanceof Error ? err.message : "Falha ao carregar conversas.");
      }
    } finally {
      inFlight.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void fetchRooms();
    }, [fetchRooms]),
  );

  const refetch = useCallback(() => {
    void fetchRooms();
  }, [fetchRooms]);

  return { rooms, loading, error, refetch };
}
