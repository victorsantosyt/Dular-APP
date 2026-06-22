import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/authStore";

export type MensagemTipo = "TEXT" | "IMAGE" | "LOCATION";

export interface Mensagem {
  id: string;
  texto: string;
  /** Tipo do conteúdo. TEXT = texto; IMAGE = data URL/URL; LOCATION = JSON {lat,lng}. */
  tipo: MensagemTipo;
  autorId: string;
  criadaEm: string;
  status?: "enviando" | "enviado" | "erro";
}

export interface UseChatReturn {
  mensagens: Mensagem[];
  /** Status do serviço associado a essa sala. Usado para bloquear envio quando arquivado. */
  servicoStatus: string | null;
  loading: boolean;
  error: string | null;
  enviar: (texto: string) => Promise<void>;
  /** Envia foto (IMAGE, content = data URL) ou localização (LOCATION, content = JSON {lat,lng}). */
  enviarMidia: (tipo: "IMAGE" | "LOCATION", content: string) => Promise<void>;
  refetch: () => void;
}

const POLL_INTERVAL = 8_000;

type RawMessage = {
  id: string;
  type?: string;
  content?: string;
  texto?: string;
  senderId?: string;
  autorId?: string;
  createdAt?: string;
  criadaEm?: string;
};

function normalize(raw: RawMessage): Mensagem {
  const tipoUp = String(raw.type ?? "TEXT").toUpperCase();
  const tipo: MensagemTipo = tipoUp === "IMAGE" || tipoUp === "LOCATION" ? tipoUp : "TEXT";
  return {
    id: raw.id,
    texto: raw.content ?? raw.texto ?? "",
    tipo,
    autorId: raw.senderId ?? raw.autorId ?? "",
    criadaEm: raw.createdAt ?? raw.criadaEm ?? new Date().toISOString(),
    status: "enviado",
  };
}

function extractMessages(data: unknown): RawMessage[] {
  if (Array.isArray(data)) return data as RawMessage[];
  if (data && typeof data === "object") {
    const obj = data as { messages?: unknown };
    if (Array.isArray(obj.messages)) return obj.messages as RawMessage[];
  }
  return [];
}

/**
 * Hook de chat (ChatAbertoScreen).
 *
 * Consome GET /api/chat/[roomId] (onde roomId = servicoId) e POST com `{ content, type: "TEXT" }`.
 * O backend retorna `{ ok, room, messages }`. Normalizamos para `Mensagem` legado para
 * preservar compat com `MensagemBubble` e demais consumidores.
 *
 * Proteções:
 * - `inFlight` evita reentrância em polling lento
 * - `mountedRef` evita setState após unmount
 * - `useFocusEffect` controla o polling: só polla com tela focada, para no blur/unmount
 */
export function useChat(roomId: string): UseChatReturn {
  const userId = useAuth((state) => state.user?.id) ?? "";
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [servicoStatus, setServicoStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFirstFetch = useRef(true);
  const inFlight = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchMensagens = useCallback(async () => {
    if (!roomId) {
      if (mountedRef.current) setLoading(false);
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    const isInitial = isFirstFetch.current;
    try {
      const res = await api.get(`/api/chat/${roomId}`);
      const rawList = extractMessages(res.data);
      const sorted = rawList
        .map(normalize)
        .sort((a, b) => new Date(a.criadaEm).getTime() - new Date(b.criadaEm).getTime());
      // Backend retorna `{ room: { servico: { status, ... } }, messages: [...] }`
      const status: string | null = res.data?.room?.servico?.status ?? null;
      if (mountedRef.current) {
        setMensagens(sorted);
        setServicoStatus(status);
        setError(null);
      }
    } catch (err) {
      if (isInitial && mountedRef.current) {
        setError(err instanceof Error ? err.message : "Erro ao carregar mensagens");
      }
    } finally {
      inFlight.current = false;
      if (isInitial) {
        isFirstFetch.current = false;
        if (mountedRef.current) setLoading(false);
      }
    }
  }, [roomId]);

  const refetch = useCallback(() => {
    void fetchMensagens();
  }, [fetchMensagens]);

  useFocusEffect(
    useCallback(() => {
      if (!roomId) {
        setLoading(false);
        return;
      }
      void fetchMensagens();
      const interval = setInterval(() => void fetchMensagens(), POLL_INTERVAL);
      return () => clearInterval(interval);
    }, [fetchMensagens, roomId]),
  );

  const enviar = useCallback(
    async (texto: string) => {
      if (!roomId) return;
      const tempId = `temp-${Date.now()}`;
      const tempMsg: Mensagem = {
        id: tempId,
        texto,
        tipo: "TEXT",
        autorId: userId,
        criadaEm: new Date().toISOString(),
        status: "enviando",
      };

      setMensagens((prev) => [...prev, tempMsg]);

      try {
        const res = await api.post(`/api/chat/${roomId}`, { content: texto, type: "TEXT" });
        const msgPayload = (res.data && typeof res.data === "object" && "message" in res.data
          ? (res.data as { message?: RawMessage }).message
          : (res.data as RawMessage)) as RawMessage | undefined;

        if (msgPayload?.id) {
          const normalized = { ...normalize(msgPayload), status: "enviado" as const };
          setMensagens((prev) => prev.map((m) => (m.id === tempId ? normalized : m)));
        } else {
          setMensagens((prev) =>
            prev.map((m) => (m.id === tempId ? { ...m, status: "enviado" } : m)),
          );
        }
      } catch {
        setMensagens((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: "erro" } : m)),
        );
      }
    },
    [roomId, userId],
  );

  const enviarMidia = useCallback(
    async (tipo: "IMAGE" | "LOCATION", content: string) => {
      if (!roomId) return;
      const tempId = `temp-${Date.now()}`;
      const tempMsg: Mensagem = {
        id: tempId,
        texto: content,
        tipo,
        autorId: userId,
        criadaEm: new Date().toISOString(),
        status: "enviando",
      };
      setMensagens((prev) => [...prev, tempMsg]);

      try {
        // O endpoint /messages aceita discriminated union { type, content }
        // (TEXT/IMAGE/LOCATION). IMAGE = data URL (mesmo padrão do avatar).
        const res = await api.post(`/api/chat/${roomId}/messages`, { type: tipo, content });
        const msgPayload = (res.data && typeof res.data === "object" && "message" in res.data
          ? (res.data as { message?: RawMessage }).message
          : (res.data as RawMessage)) as RawMessage | undefined;

        if (msgPayload?.id) {
          const normalized = { ...normalize(msgPayload), status: "enviado" as const };
          setMensagens((prev) => prev.map((m) => (m.id === tempId ? normalized : m)));
        } else {
          setMensagens((prev) =>
            prev.map((m) => (m.id === tempId ? { ...m, status: "enviado" } : m)),
          );
        }
      } catch {
        setMensagens((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: "erro" } : m)),
        );
      }
    },
    [roomId, userId],
  );

  return { mensagens, servicoStatus, loading, error, enviar, enviarMidia, refetch };
}
