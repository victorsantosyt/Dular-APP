import type { RelacaoDoAviso } from "@/api/notificacoesApi";

/**
 * Faixa da tela de Verificação quando ela é aberta por um aviso. O texto do
 * aviso não decide nada: a situação mostrada abaixo é a atual (/api/me), e a
 * faixa só situa o aviso. Nenhuma faixa instrui ação.
 *
 * Aviso antigo (sem vínculo explícito) não é atribuído a uma decisão: a faixa
 * diz só o que o tempo garante, ou que o contexto é incerto. Backend anterior
 * ao campo `vinculo` cai no mesmo tratamento cauteloso.
 */
export function faixaDoAviso(relacao: RelacaoDoAviso | null, vinculo: "EXPLICITO" | "SEM_VINCULO" | null | undefined): string | null {
  if (!relacao || relacao === "VIGENTE") return null;
  if (vinculo === "EXPLICITO") {
    if (relacao === "ENVIO_ANTERIOR") return "Este aviso é de um envio anterior. A situação abaixo é a atual da sua verificação.";
    if (relacao === "SUPERADA") return "A decisão deste aviso foi revista. A situação abaixo é a decisão vigente.";
  }
  if (relacao === "ENVIO_ANTERIOR") return "Este aviso é anterior ao seu envio atual. A situação abaixo é a atual da sua verificação.";
  if (relacao === "SUPERADA") return "Houve decisão mais recente depois deste aviso. A situação abaixo é a atual.";
  return "Não é possível relacionar este aviso a uma decisão específica. A situação abaixo é a atual da sua verificação.";
}
