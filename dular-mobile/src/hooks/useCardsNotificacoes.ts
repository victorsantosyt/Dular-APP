import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { listarCards, marcarLidasEmLote, type FiltroCards } from "@/api/notificacoesApi";
import { criarListaDeCards, type EstadoCards } from "@/lib/cardsNotificacoes";
import { epocaSessao } from "@/lib/sessaoAtual";
import { useAoMudarConta } from "@/hooks/useSincronizacaoConta";
import { invalidarNotificacoes } from "@/hooks/useNotificacoes";

/**
 * Cards da tela de Notificações (GET /api/notificacoes/cards).
 *
 * Atualiza ao focar e quando o motor de sincronização acusa mudança em
 * "verificacao" (envio, aprovação, reprovação, revisão) ou "avisos" (aviso
 * novo, leitura). O motor já consulta ao voltar ao primeiro plano e repete
 * após falha de rede — aqui não há consulta periódica nem uma por card.
 */
export function useCardsNotificacoes(filtro: FiltroCards) {
  const [estado, setEstado] = useState<EstadoCards | null>(null);
  const lista = useRef(
    criarListaDeCards({
      buscar: ({ filtro: f, cursor }) => listarCards({ filtro: f, cursor }),
      epoca: epocaSessao,
      notificar: (e) => setEstado(e),
    }, filtro),
  ).current;

  useEffect(() => {
    void lista.recarregar(filtro);
  }, [filtro, lista]);

  useFocusEffect(useCallback(() => { void lista.recarregar(); }, [lista]));
  useAoMudarConta(["verificacao", "avisos"], () => { void lista.recarregar(); });

  /** Marca como lidos SÓ os eventos mostrados e atualiza o sino (lista antiga) também. */
  const marcarMostrados = useCallback(async (cardId: string, ids: string[]) => {
    if (ids.length === 0) return;
    lista.marcarLidosLocal(cardId, ids.length);
    try {
      await marcarLidasEmLote(ids);
    } finally {
      invalidarNotificacoes();
      void lista.recarregar();
    }
  }, [lista]);

  return {
    estado: estado ?? lista.atual(),
    recarregar: () => lista.recarregar(),
    carregarMais: () => lista.carregarMais(),
    marcarMostrados,
    /** O toque já marcou o principal (lib/abrirNotificacao): só refletir na lista. */
    refletirLeituraDoPrincipal: (cardId: string) => lista.marcarLidosLocal(cardId, 1),
  };
}
