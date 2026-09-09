import { create } from "zustand";
import type { NotificacaoTipo } from "@/api/notificacoesApi";

/**
 * Fila do popup in-app de notificação.
 *
 * Por que existe: com o app ABERTO, quem aparecia era o banner do sistema
 * operacional — que não dá para estilizar e não segue o tema do perfil. O
 * listener de push do app recebia o evento e não fazia nada
 * (`addNotificationReceivedListener(() => {})`). Este store é o canal para
 * mostrar um aviso próprio, com a identidade do Dular.
 *
 * É uma FILA, não um valor único: duas notificações que chegam juntas (aceite
 * + primeira mensagem, por exemplo) apareceriam uma por cima da outra, e a
 * primeira sumiria sem ser lida. Aqui a segunda espera a vez.
 */
export type PopupNotificacao = {
  /** Chave de render; gerada no `mostrar` quando não vier do backend. */
  id: string;
  tipo: NotificacaoTipo | string;
  titulo: string;
  corpo: string;
  /** Para onde levar ao tocar. Sem isto, o popup só informa. */
  servicoId?: string | null;
  chatRoomId?: string | null;
};

type Estado = {
  fila: PopupNotificacao[];
  /** A que está na tela agora; `null` quando não há nada. */
  atual: PopupNotificacao | null;
  mostrar: (n: Omit<PopupNotificacao, "id"> & { id?: string }) => void;
  /** Descarta a atual e puxa a próxima da fila, se houver. */
  proxima: () => void;
};

export const useNotificacaoPopup = create<Estado>((set, get) => ({
  fila: [],
  atual: null,

  mostrar(n) {
    const item: PopupNotificacao = {
      ...n,
      id: n.id ?? `popup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    };
    // Sem nada na tela, entra direto; senão espera a vez.
    if (!get().atual) set({ atual: item });
    else set((s) => ({ fila: [...s.fila, item] }));
  },

  proxima() {
    const [proxima, ...resto] = get().fila;
    set({ atual: proxima ?? null, fila: resto });
  },
}));
