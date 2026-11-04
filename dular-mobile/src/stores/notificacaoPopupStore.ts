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
  /** Id da Notification no backend (toque marca só ela como lida). */
  notificationId?: string | null;
  /**
   * Agrupamento (ex.: `chat:<servicoId>`). Um aviso com a mesma chave de outro
   * que ainda ESPERA na fila substitui o conteúdo dele no mesmo lugar — a fila
   * nunca tem dois da mesma conversa, e fica a prévia mais nova. Se o da mesma
   * chave já está NA TELA, o novo entra na fila (não é descartado).
   */
  chave?: string | null;
};

type Estado = {
  fila: PopupNotificacao[];
  /** A que está na tela agora; `null` quando não há nada. */
  atual: PopupNotificacao | null;
  mostrar: (n: Omit<PopupNotificacao, "id"> & { id?: string }) => void;
  /** Descarta a atual e puxa a próxima da fila, se houver. */
  proxima: () => void;
  /** Logout: nenhum aviso da conta que saiu aparece para a próxima. */
  limpar: () => void;
};

export const useNotificacaoPopup = create<Estado>((set, get) => ({
  fila: [],
  atual: null,

  mostrar(n) {
    const item: PopupNotificacao = {
      ...n,
      id: n.id ?? `popup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    };
    const { atual, fila } = get();
    if (item.chave) {
      const i = fila.findIndex((f) => f.chave === item.chave);
      if (i >= 0) {
        const nova = [...fila];
        nova[i] = { ...item, id: fila[i].id };
        set({ fila: nova });
        return;
      }
    }
    // Sem nada na tela, entra direto; senão espera a vez.
    if (!atual) set({ atual: item });
    else set({ fila: [...fila, item] });
  },

  proxima() {
    const [proxima, ...resto] = get().fila;
    set({ atual: proxima ?? null, fila: resto });
  },

  limpar() {
    set({ atual: null, fila: [] });
  },
}));
