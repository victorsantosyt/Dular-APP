import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

export interface ChatRoom {
  id: string;
  servicoId: string;
  outroUsuario: {
    id: string;
    nome: string;
    avatarUrl?: string;
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

const POLL_INTERVAL = 15_000;

export function useMensagens(): UseMensagensReturn {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFirstFetch = useRef(true);

  const fetchRooms = useCallback(async () => {
    const isInitial = isFirstFetch.current;
    try {
      const res = await api.get<ChatRoom[]>("/api/chat");
      const sorted = [...res.data].sort(
        (a, b) =>
          new Date(b.atualizadaEm).getTime() - new Date(a.atualizadaEm).getTime()
      );
      setRooms(sorted);
      setError(null);
    } catch (err) {
      // Keep previous data on poll errors; only surface error on initial load
      if (isInitial) {
        setError(err instanceof Error ? err.message : "Erro ao carregar mensagens");
      }
    } finally {
      if (isInitial) {
        isFirstFetch.current = false;
        setLoading(false);
      }
    }
  }, []);

  const refetch = useCallback(() => {
    void fetchRooms();
  }, [fetchRooms]);

  useEffect(() => {
    void fetchRooms();
    const interval = setInterval(() => void fetchRooms(), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  return { rooms, loading, error, refetch };
}
