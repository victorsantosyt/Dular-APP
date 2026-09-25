import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "@/lib/api";
import { getAblyRealtime, Ably } from "@/lib/ably";
import { sendHeartbeat } from "@/api/heartbeatApi";
import { definirChatAberto, limparChatAberto } from "@/lib/chatAberto";
import { canalOperacional, criarFallback, type EstadoRealtime } from "@/lib/fallbackChat";
import { confirmarEnvio, criarSincronizador, mesclarMensagens } from "@/lib/sincronizadorChat";
import { useAuth } from "@/stores/authStore";

export type MensagemTipo = "TEXT" | "IMAGE" | "LOCATION" | "SYSTEM";

export interface Mensagem {
  id: string;
  texto: string;
  /** Tipo do conteúdo. TEXT = texto; IMAGE = data URL/URL; LOCATION = JSON {lat,lng}. */
  tipo: MensagemTipo;
  autorId: string;
  criadaEm: string;
  /** Timestamp ISO de quando a mensagem foi entregue ao destinatário; null = ainda não. */
  deliveredAt: string | null;
  /** Timestamp ISO de quando o destinatário leu a mensagem; null = ainda não lida. */
  readAt: string | null;
  status?: "enviando" | "enviado" | "erro";
}

export interface OutroUsuario {
  nome: string;
  avatarUrl: string | null;
  role: string | null;
  /** Última presença (heartbeat) do outro usuário; null = nunca visto. */
  lastSeenAt: string | null;
}

export interface UseChatReturn {
  mensagens: Mensagem[];
  /** Status do serviço associado a essa sala. Usado para bloquear envio quando arquivado. */
  servicoStatus: string | null;
  /** Outro participante da conversa (nome, foto, papel) — vindo do GET da sala. */
  outroUsuario: OutroUsuario | null;
  /** Tipo do serviço da sala (BABA, MONTADOR, FAXINA…). */
  servicoTipo: string | null;
  /** Estado do pagamento PIX do serviço (WAITING_PAYMENT, PAYMENT_REPORTED…). */
  paymentStatus: string | null;
  /** Valor congelado do serviço em CENTAVOS (precoFinal). */
  precoFinal: number | null;
  /** true quando o profissional do serviço tem chave PIX cadastrada. */
  profissionalTemPix: boolean;
  loading: boolean;
  error: string | null;
  /** true enquanto o outro participante está com a sala aberta (presence Ably). Uso futuro (indicador online). */
  isPeerOnline: boolean;
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
  deliveredAt?: string | null;
  readAt?: string | null;
};

function normalize(raw: RawMessage): Mensagem {
  const tipoUp = String(raw.type ?? "TEXT").toUpperCase();
  const tipo: MensagemTipo =
    tipoUp === "IMAGE" || tipoUp === "LOCATION" || tipoUp === "SYSTEM"
      ? (tipoUp as MensagemTipo)
      : "TEXT";
  return {
    id: raw.id,
    texto: raw.content ?? raw.texto ?? "",
    tipo,
    autorId: raw.senderId ?? raw.autorId ?? "",
    criadaEm: raw.createdAt ?? raw.criadaEm ?? new Date().toISOString(),
    deliveredAt: raw.deliveredAt ?? null,
    readAt: raw.readAt ?? null,
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
 * - pedidos durante uma busca viram UMA busca extra, sem perder evento (lib/sincronizadorChat)
 * - `mountedRef` evita setState após unmount
 * - `useFocusEffect` controla o fallback: só consulta com tela focada, para no blur/unmount
 * - o fallback depende do CANAL da sala (conexão + canal attached + assinatura),
 *   não só da conexão Ably — ver lib/fallbackChat
 */
export function useChat(roomId: string): UseChatReturn {
  const userId = useAuth((state) => state.user?.id) ?? "";
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [servicoStatus, setServicoStatus] = useState<string | null>(null);
  const [outroUsuario, setOutroUsuario] = useState<OutroUsuario | null>(null);
  const [servicoTipo, setServicoTipo] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [precoFinal, setPrecoFinal] = useState<number | null>(null);
  const [profissionalTemPix, setProfissionalTemPix] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPeerOnline, setIsPeerOnline] = useState(false);
  const isFirstFetch = useRef(true);
  const mountedRef = useRef(true);
  // Estado do realtime da SALA, lido de forma síncrona pelo fallback. Mora num
  // ref (não em state) para trocar de estado sem re-render nem re-criar
  // intervalos: um único controlador decide se consulta ou não.
  const realtimeRef = useRef<EstadoRealtime>({ conexao: "initialized", canal: "initialized", assinado: false });
  const fallbackRef = useRef<ReturnType<typeof criarFallback> | null>(null);
  const avaliarFallback = useCallback(() => {
    fallbackRef.current?.atualizar(canalOperacional(realtimeRef.current));
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Heartbeat de presença: enquanto a conversa está aberta, marca lastSeenAt a
  // cada 30s (e imediatamente ao abrir). Silencioso e local a este hook — sem
  // presença global. Intervalo separado do polling de mensagens (8s).
  useEffect(() => {
    if (!roomId) return;
    void sendHeartbeat();
    const interval = setInterval(() => void sendHeartbeat(), 30_000);
    return () => clearInterval(interval);
  }, [roomId]);

  // Uma busca da sala. Só aplica o resultado se a sincronização ainda vale
  // (tela montada, mesma conversa): `signal` é abortado no cleanup/troca.
  const buscarSala = useCallback(
    async (signal: AbortSignal) => {
      const isInitial = isFirstFetch.current;
      try {
        const res = await api.get(`/api/chat/${roomId}`, { signal });
        if (signal.aborted || !mountedRef.current) return;
        const servidor = extractMessages(res.data).map(normalize);
        // Backend retorna `{ room: { servico: { status, tipo, precoFinal,
        // paymentStatus }, pagamento: { profissionalTemPix }, other }, messages }`
        const status: string | null = res.data?.room?.servico?.status ?? null;
        const tipo: string | null = res.data?.room?.servico?.tipo ?? null;
        const payStatus: string | null = res.data?.room?.servico?.paymentStatus ?? null;
        const preco: number | null =
          typeof res.data?.room?.servico?.precoFinal === "number"
            ? res.data.room.servico.precoFinal
            : null;
        const temPix: boolean = res.data?.room?.pagamento?.profissionalTemPix === true;
        const other = res.data?.room?.other ?? null;
        // Mescla com o que só existe no aparelho (mensagem ainda enviando).
        setMensagens((locais) => mesclarMensagens(servidor, locais));
        setServicoStatus(status);
        setServicoTipo(tipo);
        setPaymentStatus(payStatus);
        setPrecoFinal(preco);
        setProfissionalTemPix(temPix);
        setOutroUsuario(
          other
            ? {
                nome: other.nome ?? "",
                avatarUrl: other.avatarUrl ?? null,
                role: other.role ?? null,
                lastSeenAt: other.lastSeenAt ?? null,
              }
            : null,
        );
        setError(null);
      } catch (err) {
        if (isInitial && !signal.aborted && mountedRef.current) {
          setError(err instanceof Error ? err.message : "Erro ao carregar mensagens");
        }
      } finally {
        if (isInitial && !signal.aborted) {
          isFirstFetch.current = false;
          if (mountedRef.current) setLoading(false);
        }
      }
    },
    [roomId],
  );

  // Um sincronizador por conversa: pedidos durante uma busca viram UMA busca
  // extra (lib/sincronizadorChat). Troca de conversa ou desmontagem para o
  // antigo — nada dele é aplicado depois.
  const sincRef = useRef<ReturnType<typeof criarSincronizador> | null>(null);
  useEffect(() => {
    if (!roomId) return;
    isFirstFetch.current = true;
    const sinc = criarSincronizador(buscarSala);
    sincRef.current = sinc;
    return () => {
      sinc.parar();
      if (sincRef.current === sinc) sincRef.current = null;
    };
  }, [roomId, buscarSala]);

  const fetchMensagens = useCallback(async () => {
    if (!roomId) {
      if (mountedRef.current) setLoading(false);
      return;
    }
    await sincRef.current?.sincronizar();
  }, [roomId]);

  const refetch = useCallback(() => {
    void fetchMensagens();
  }, [fetchMensagens]);

  // Realtime (Ably): ao abrir a sala, conecta autenticado por TOKEN e assina
  // APENAS `chat:{roomId}`. Ao receber `new_message`, dispara fetchMensagens() —
  // o GET permanece a ÚNICA fonte da verdade (o evento NÃO traz conteúdo). O
  // polling de 8s abaixo continua inalterado, como redundância independente.
  // `fetchRef` mantém a última fetchMensagens sem re-assinar o canal.
  const fetchRef = useRef(fetchMensagens);
  useEffect(() => {
    fetchRef.current = fetchMensagens;
  }, [fetchMensagens]);

  useEffect(() => {
    if (!roomId) return;
    const client = getAblyRealtime();
    const channel = client.channels.get(`chat:${roomId}`);
    let cancelled = false;
    realtimeRef.current = { conexao: client.connection.state, canal: channel.state, assinado: false };

    const onNewMessage = () => {
      void fetchRef.current();
    };

    // Conexão: só `connected` conta. Qualquer outro estado reativa o fallback.
    // A reconexão é 100% do SDK (sem timer/backoff nosso).
    const onConnState = (stateChange: Ably.ConnectionStateChange) => {
      if (cancelled) return;
      realtimeRef.current = { ...realtimeRef.current, conexao: stateChange.current };
      avaliarFallback();
      if (stateChange.current === "connected") {
        // (Re)sincroniza a presença do outro ao (re)conectar.
        channel.presence
          .get()
          .then((members) => {
            if (cancelled) return;
            setIsPeerOnline(members.some((m) => m.clientId && m.clientId !== userId));
          })
          .catch(() => {});
      }
    };

    // Canal: conexão viva não prova que a SALA funciona. Se o canal falhar
    // (ex.: token sem permissão para uma sala criada depois dele) ou for
    // suspenso/desanexado, o fallback volta a consultar a API.
    const onChannelState = (stateChange: Ably.ChannelStateChange) => {
      if (cancelled) return;
      const canal = stateChange.current;
      realtimeRef.current = {
        ...realtimeRef.current,
        canal,
        assinado: canal === "attached" ? realtimeRef.current.assinado : false,
      };
      avaliarFallback();
    };

    // Presence do OUTRO participante via eventos enter/leave (ignora o próprio).
    const onPeerPresence = (member: Ably.PresenceMessage) => {
      if (cancelled || !member.clientId || member.clientId === userId) return;
      setIsPeerOnline(member.action === "enter");
    };

    client.connection.on(onConnState);
    channel.on(onChannelState);
    client.connect();
    // A assinatura só conta como ativa quando o SDK confirma (anexou o canal).
    channel
      .subscribe("new_message", onNewMessage)
      .then(() => {
        if (cancelled) return;
        realtimeRef.current = { ...realtimeRef.current, canal: channel.state, assinado: true };
        avaliarFallback();
      })
      .catch(() => {
        if (cancelled) return;
        realtimeRef.current = { ...realtimeRef.current, canal: channel.state, assinado: false };
        avaliarFallback();
      });
    void channel.presence.subscribe("enter", onPeerPresence).catch(() => {});
    void channel.presence.subscribe("leave", onPeerPresence).catch(() => {});
    // Após conectar, entra na presença (o SDK enfileira até o connected e
    // re-entra sozinho em reconexões).
    channel.presence.enter().catch(() => {});

    // Ao sair da tela: remove listeners, sai da presença e fecha a conexão.
    return () => {
      cancelled = true;
      channel.unsubscribe("new_message", onNewMessage);
      channel.presence.unsubscribe();
      channel.presence.leave().catch(() => {});
      channel.off(onChannelState);
      client.connection.off(onConnState);
      client.close();
      realtimeRef.current = { conexao: "closed", canal: "detached", assinado: false };
      avaliarFallback();
      setIsPeerOnline(false);
    };
  }, [roomId, userId, avaliarFallback]);

  useFocusEffect(
    useCallback(() => {
      if (!roomId) {
        setLoading(false);
        return;
      }
      // Sync ao focar. Depois, UM controlador decide entre realtime e consulta
      // periódica pelo estado real do canal — nunca dois intervalos, nunca
      // realtime + polling juntos.
      void fetchMensagens();
      const fallback = criarFallback({ intervaloMs: POLL_INTERVAL, buscar: () => void fetchRef.current() });
      fallbackRef.current = fallback;
      avaliarFallback();
      // Conversa na tela: o push dela não vira popup (lib/pushPrimeiroPlano).
      definirChatAberto(roomId, () => fetchRef.current());
      return () => {
        fallback.parar();
        if (fallbackRef.current === fallback) fallbackRef.current = null;
        limparChatAberto(roomId);
      };
    }, [fetchMensagens, roomId, avaliarFallback]),
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
        deliveredAt: null,
        readAt: null,
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
          setMensagens((prev) => confirmarEnvio(prev, tempId, normalized));
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
        deliveredAt: null,
        readAt: null,
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
          setMensagens((prev) => confirmarEnvio(prev, tempId, normalized));
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

  return {
    mensagens,
    servicoStatus,
    outroUsuario,
    servicoTipo,
    paymentStatus,
    precoFinal,
    profissionalTemPix,
    loading,
    error,
    isPeerOnline,
    enviar,
    enviarMidia,
    refetch,
  };
}
