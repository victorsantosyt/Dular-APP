import { useCallback, useRef } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

/**
 * Perfil público e portfólio de OUTRA conta: a sincronização da conta de quem
 * olha não enxerga mudanças do profissional. A tela relê sozinha enquanto está
 * em foco e o app em primeiro plano — a cada INTERVALO_PERFIL_PUBLICO_MS, ao
 * voltar para a tela e ao voltar do segundo plano. Fora de foco, nada roda.
 */
export const INTERVALO_PERFIL_PUBLICO_MS = 30_000;

export function useAtualizacaoPeriodica(recarregar: () => void, intervaloMs = INTERVALO_PERFIL_PUBLICO_MS): void {
  const fn = useRef(recarregar);
  fn.current = recarregar;
  const primeiroFoco = useRef(true);

  useFocusEffect(
    useCallback(() => {
      // O primeiro foco é a carga inicial da própria tela; os seguintes relêem.
      if (!primeiroFoco.current) fn.current();
      primeiroFoco.current = false;

      let timer: ReturnType<typeof setInterval> | null = null;
      const ligar = () => { if (!timer) timer = setInterval(() => fn.current(), intervaloMs); };
      const desligar = () => { if (timer) clearInterval(timer); timer = null; };
      if (AppState.currentState === "active") ligar();
      const sub = AppState.addEventListener("change", (estado) => {
        if (estado === "active") { fn.current(); ligar(); }
        else desligar();
      });
      return () => { sub.remove(); desligar(); };
    }, [intervaloMs]),
  );
}
