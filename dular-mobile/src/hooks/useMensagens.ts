import { useCallback, useState } from "react";

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

/**
 * Hotfix T-13:
 * O endpoint GET /api/chat (lista de salas) ainda não existe no backend.
 * A versão anterior fazia polling em /api/chat a cada 15s, gerando 404 em
 * loop em todas as telas que consumiam o hook (perfis, home, etc.), o que
 * travava o app por dezenas de requisições paralelas falhando.
 *
 * Enquanto o endpoint não existir, retornamos um estado vazio e estável.
 * Quando o backend implementar GET /api/chat, basta restaurar a chamada
 * `api.get<ChatRoom[]>("/api/chat")` e o intervalo.
 */
export function useMensagens(): UseMensagensReturn {
  const [rooms] = useState<ChatRoom[]>([]);

  const refetch = useCallback(() => {
    // no-op enquanto o endpoint não existir
  }, []);

  return { rooms, loading: false, error: null, refetch };
}
