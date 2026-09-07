import { useCallback } from "react";
import { useNavigation } from "@react-navigation/native";

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
      const e = erro as {
        response?: { status?: number; data?: { error?: string; message?: string } };
      };
      const dados = e?.response?.data;
      if (e?.response?.status !== 403 || dados?.error !== "LIMIT_EXCEEDED") {
        return false;
      }
      navigation.navigate("Paywall", {
        mensagem:
          dados.message ??
          "Você atingiu o limite do seu plano. Assine para continuar aceitando serviços.",
      });
      return true;
    },
    [navigation],
  );

  return { tratar };
}
