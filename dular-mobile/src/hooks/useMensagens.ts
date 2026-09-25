import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "@/lib/api";
import { criarCacheCompartilhado } from "@/lib/cacheCompartilhado";
import { sessaoAtual } from "@/lib/sessaoAtual";

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
    /** Quem mandou (para prefixo "Você: " no card). */
    senderId: string;
    /** TEXT | IMAGE | LOCATION | SYSTEM. */
    type: string;
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
    /** Backend novo manda `content`; mantemos `texto` para compat. */
    content?: string;
    texto?: string;
    /** Backend novo manda `createdAt`; mantemos `criadaEm` para compat. */
    createdAt?: string;
    criadaEm?: string;
    senderId?: string;
    type?: string;
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
    ultimaMensagem: (() => {
      const u = raw.ultimaMensagem;
      const texto = u?.content ?? u?.texto ?? "";
      if (!u || !texto) return undefined;
      return {
        texto,
        criadaEm: u.createdAt ?? u.criadaEm ?? raw.createdAt ?? "",
        lida: Boolean(u.lida),
        senderId: u.senderId ?? "",
        type: String(u.type ?? "TEXT").toUpperCase(),
      };
    })(),
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

const cacheSalas = criarCacheCompartilhado<ChatRoom[]>({
  staleMs: STALE_MS,
  vazio: () => [],
  mensagemDeErro: (err) => (err instanceof Error ? err.message : "Falha ao carregar conversas."),
  chaveSessao: sessaoAtual,
  buscar: async (signal) => {
    const res = await api.get<{ ok?: boolean; rooms?: RawRoom[] }>("/api/chat", { signal });
    const rawList = Array.isArray(res.data?.rooms) ? res.data.rooms : [];
    return rawList.map(normalizeRoom);
  },
});

/**
 * Sabe-se que a lista mudou (push de mensagem com o app aberto): busca de
 * novo agora, sem esperar os 15 s nem uma troca de tela. Todas as telas e o
 * contador da barra atualizam juntos.
 */
export function invalidarMensagens(): void {
  cacheSalas.invalidar();
}

/**
 * Lista buscada agora, da sessão atual (popup de mensagem com o app aberto).
 * `null` se falhar ou se a sessão mudar no meio — nunca dado velho ou de outra
 * conta. Também atualiza a lista e o contador de todas as telas.
 */
export async function atualizarMensagensAgora(): Promise<ChatRoom[] | null> {
  const r = await cacheSalas.obterAtualizado();
  if (!r || r.erro) return null;
  return r.valor;
}

/** Troca de conta: a lista da conta anterior não pode aparecer na próxima. */
export function limparCacheMensagens(): void {
  cacheSalas.limpar();
}

/** Soma de mensagens não-lidas de todas as salas (badge da aba Mensagens). */
export function totalNaoLidas(rooms: ChatRoom[]): number {
  return rooms.reduce((total, room) => total + Math.max(0, Number(room.naoLidas) || 0), 0);
}

export function useMensagens(): UseMensagensReturn {
  const [rooms, setRooms] = useState<ChatRoom[]>(cacheSalas.atual().valor ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(cacheSalas.atual().erro);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    // Inscreve-se em atualizações do cache (qualquer instance fetcha → todas atualizam)
    const cancelar = cacheSalas.assinar(() => {
      if (!mountedRef.current) return;
      const { valor, erro } = cacheSalas.atual();
      setRooms(valor ?? []);
      setError(erro);
    });
    return () => {
      mountedRef.current = false;
      cancelar();
    };
  }, []);

  const triggerFetch = useCallback(async (force = false) => {
    if (mountedRef.current) setLoading(true);
    const result = await cacheSalas.obter(force);
    if (!mountedRef.current) return;
    setRooms(result.valor);
    setError(result.erro);
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
