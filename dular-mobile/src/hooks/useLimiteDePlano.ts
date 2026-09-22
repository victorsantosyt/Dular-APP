import { useCallback } from "react";
import { useNavigation } from "@react-navigation/native";

import { paramsDeLimiteExcedido } from "@/lib/paywall";

/**
 * Trata o 403 LIMIT_EXCEEDED do backend levando o profissional ao paywall.
 *
 * O bloqueio vem de `checkFeatureAccess` em `/api/servicos/[id]/aceitar` e
 * cobre os dois casos: estourar o limite do gratuito e assinatura vencida
 * (CANCELED/EXPIRED são rebaixados para FREE no gate).
 *
 * Existe como hook compartilhado porque há quatro pontos de aceite (dois do
 * montador, dois da diarista) e repetir o tratamento em cada um garantiria
 * que algum ficasse para trás.
 */
export function useLimiteDePlano() {
  const navigation = useNavigation<any>();

  /** Devolve true quando reconheceu o limite e já navegou. */
  const tratar = useCallback(
    (erro: unknown): boolean => {
      // O reconhecimento do 403 mora em `paramsDeLimiteExcedido` para poder
      // ser exercitado sem React — é a regra que decide se a pessoa vê uma
      // oferta de plano no lugar de uma mensagem de erro.
      const params = paramsDeLimiteExcedido(erro);
      if (!params) return false;
      navigation.navigate("Paywall", params);
      return true;
    },
    [navigation],
  );

  return { tratar };
}
