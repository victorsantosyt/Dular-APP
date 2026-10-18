import { useCallback, useEffect, useRef } from "react";

/**
 * Protege a tela contra resposta velha: cada leitura chama `iniciar()` e só
 * aplica o resultado se `vale()` — ou seja, se nenhuma leitura mais nova
 * começou (foco, sincronização e pull-to-refresh podem se cruzar) e a tela
 * continua montada.
 */
export function useUltimaLeitura(): () => () => boolean {
  const atual = useRef(0);
  useEffect(() => () => { atual.current++; }, []);
  return useCallback(() => {
    const minha = ++atual.current;
    return () => minha === atual.current;
  }, []);
}
