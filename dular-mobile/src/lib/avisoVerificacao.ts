import type { RelacaoDoAviso } from "@/api/notificacoesApi";

/**
 * Faixa da tela de Verificação quando ela é aberta por um aviso. O texto do
 * aviso não decide nada: a situação mostrada abaixo é a atual (/api/me), e a
 * faixa só explica que o aviso é histórico. Nenhuma faixa instrui ação.
 */
export function faixaDoAviso(relacao: RelacaoDoAviso | null): string | null {
  switch (relacao) {
    case "ENVIO_ANTERIOR":
      return "Este aviso é de um envio anterior. A situação abaixo é a atual da sua verificação.";
    case "SUPERADA":
      return "A decisão deste aviso foi revista. A situação abaixo é a decisão vigente.";
    case "INDETERMINADA":
      return "Este aviso faz parte do histórico. A situação abaixo é a atual da sua verificação.";
    default:
      return null;
  }
}
