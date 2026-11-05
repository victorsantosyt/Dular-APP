import type { CardNotificacao, FiltroCards, PaginaDeCards } from "@/api/notificacoesApi";

/**
 * Estado da lista de cards (sem imports de app; testado em Node).
 *
 * - Só a resposta da ÚLTIMA consulta vale; trocar de conta, de filtro ou
 *   recarregar descarta as que estiverem em curso.
 * - Falha de rede nunca vira "resolvido": a lista mantém o que já tinha,
 *   marca `erro` e oferece tentar de novo. Sem nada carregado, mostra erro.
 * - "Carregar mais" junta páginas sem repetir card (o cursor do servidor já é
 *   estável; o filtro por id protege contra recargas no meio).
 */
export type EstadoCards = {
  filtro: FiltroCards;
  cards: CardNotificacao[];
  proximoCursor: string | null;
  contadores: PaginaDeCards["contadores"] | null;
  carregando: boolean;
  erro: string | null;
  /** O servidor não tem a rota de cards (backend anterior): usar a lista antiga. */
  semSuporte: boolean;
};

export type DependenciasCards = {
  buscar: (p: { filtro: FiltroCards; cursor: string | null }) => Promise<PaginaDeCards>;
  epoca: () => number;
  notificar: (e: EstadoCards) => void;
};

export function criarListaDeCards(deps: DependenciasCards, filtroInicial: FiltroCards = "todas") {
  let estado: EstadoCards = { filtro: filtroInicial, cards: [], proximoCursor: null, contadores: null, carregando: false, erro: null, semSuporte: false };
  let geracao = 0;
  let epocaDosDados = deps.epoca();

  const set = (parcial: Partial<EstadoCards>) => {
    estado = { ...estado, ...parcial };
    deps.notificar(estado);
  };

  async function carregar(modo: "recarregar" | "mais", filtro = estado.filtro) {
    const minha = ++geracao;
    const epoca = deps.epoca();
    if (epoca !== epocaDosDados) {
      // Outra conta: nada da anterior pode aparecer, nem enquanto carrega.
      epocaDosDados = epoca;
      set({ cards: [], proximoCursor: null, contadores: null, erro: null });
    }
    const cursor = modo === "mais" ? estado.proximoCursor : null;
    if (modo === "mais" && !cursor) return;
    if (filtro !== estado.filtro) set({ filtro, cards: [], proximoCursor: null });
    set({ carregando: true });
    try {
      const pagina = await deps.buscar({ filtro, cursor });
      if (minha !== geracao || deps.epoca() !== epoca) return;
      const anteriores = modo === "mais" ? estado.cards : [];
      const vistos = new Set(anteriores.map((c) => c.id));
      set({
        cards: [...anteriores, ...pagina.cards.filter((c) => !vistos.has(c.id))],
        proximoCursor: pagina.proximoCursor,
        contadores: pagina.contadores,
        carregando: false,
        erro: null,
        semSuporte: false,
      });
    } catch (e) {
      if (minha !== geracao || deps.epoca() !== epoca) return;
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        set({ carregando: false, semSuporte: true });
        return;
      }
      set({ carregando: false, erro: "Não foi possível atualizar as notificações." });
    }
  }

  return {
    atual: () => estado,
    recarregar: (filtro?: FiltroCards) => carregar("recarregar", filtro),
    carregarMais: () => carregar("mais"),
    /** Depois de marcar eventos como lidos: reflete já, sem esperar a recarga. */
    marcarLidosLocal(cardId: string, quantos: number) {
      set({ cards: estado.cards.map((c) => (c.id === cardId ? { ...c, naoLidos: Math.max(0, c.naoLidos - quantos) } : c)) });
    },
  };
}

/** Datas do card: a do evento original e, se diferente, a da atualização do estado. */
export function datasDoCard(card: CardNotificacao): { evento: string; estadoAtualizadoEm: string | null } {
  const atualizado = card.apresentacao?.estadoAtualizadoEm ?? null;
  const evento = card.principal.createdAt;
  const diferente = atualizado != null && Math.abs(Date.parse(atualizado) - Date.parse(evento)) > 60_000;
  return { evento, estadoAtualizadoEm: diferente ? atualizado : null };
}

/** Linha principal do card: o estado atual quando houver; senão, o título do evento. */
export function tituloDoCard(card: CardNotificacao): string {
  return card.apresentacao ? `${card.apresentacao.rotulo} — ${card.apresentacao.titulo}` : card.principal.title;
}
