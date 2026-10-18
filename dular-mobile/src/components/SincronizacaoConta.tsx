import { useSincronizacaoConta } from "@/hooks/useSincronizacaoConta";

/** Mantém a conta em sincronia com o backend (hooks/useSincronizacaoConta). Não renderiza nada. */
export function SincronizacaoConta() {
  useSincronizacaoConta();
  return null;
}
