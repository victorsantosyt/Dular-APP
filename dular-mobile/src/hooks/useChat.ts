import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/authStore";

export interface Mensagem {
  id: string;
  texto: string;
  autorId: string;
  criadaEm: string;
  status?: "enviando" | "enviado" | "erro";
}

export interface UseChatReturn {
  mensagens: Mensagem[];
  loading: boolean;
  error: string | null;
  enviar: (texto: string) => Promise<void>;
  refetch: () => void;
}

const POLL_INTERVAL = 8_000;

export function useChat(roomId: string): UseChatReturn {
  const userId = useAuth((state) => state.user?.id) ?? "";
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFirstFetch = useRef(true);
  const inFlight = useRef(false);

  const fetchMensagens = useCallback(async () => {
    if (!roomId) {
      // Sem sala válida: nada a buscar. Evita 404 em loop.
      setLoading(false);
      return;
    }
    if (inFlight.current) return; // evita reentrância em polling lento
    inFlight.current = true;
    const isInitial = isFirstFetch.current;
    try {
      const res = await api.get<Mensagem[]>(`/api/chat/${roomId}`);
      const data = Array.isArray(res.data) ? res.data : [];
      const sorted = [...data].sort(
        (a, b) => new Date(a.criadaEm).getTime() - new Date(b.criadaEm).getTime()
      );
      setMensagens(sorted);
      setError(null);
    } catch (err) {
      // On poll errors keep previous data; surface error only on initial load
      if (isInitial) {
        setError(err instanceof Error ? err.message : "Erro ao carregar mensagens");
      }
    } finally {
      inFlight.current = false;
      if (isInitial) {
        isFirstFetch.current = false;
        setLoading(false);
      }
    }
  }, [roomId]);

  const refetch = useCallback(() => {
    void fetchMensagens();
  }, [fetchMensagens]);

  useEffect(() => {
    if (!roomId) {
      setLoading(false);
      return;
    }
    void fetchMensagens();
    const interval = setInterval(() => void fetchMensagens(), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchMensagens, roomId]);

  const enviar = useCallback(
    async (texto: string) => {
      if (!roomId) return;
      const tempId = `temp-${Date.now()}`;
      const tempMsg: Mensagem = {
        id: tempId,
        texto,
        autorId: userId,
        criadaEm: new Date().toISOString(),
        status: "enviando",
      };

      setMensagens((prev) => [...prev, tempMsg]);

      try {
        const res = await api.post<Mensagem>(`/api/chat/${roomId}`, { texto });
        setMensagens((prev) =>
          prev.map((m) => (m.id === tempId ? { ...res.data, status: "enviado" } : m))
        );
      } catch {
        setMensagens((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, status: "erro" } : m
          )
        );
      }
    },
    [roomId, userId]
  );

  return { mensagens, loading, error, enviar, refetch };
}
