import type { Decisao } from "@/lib/decisaoVerificacao";

/**
 * A que decisão de verificação um aviso se refere, e se ela ainda vale.
 *
 * - Avisos novos têm vínculo explícito (`verificacaoId` + `decisaoVerificacaoId`,
 *   gravados na mesma transação da decisão). A relação é exata.
 * - Avisos antigos não têm vínculo. Não se tenta adivinhar a decisão: só se
 *   afirma o que o tempo garante (o aviso é anterior ao envio atual, ou
 *   anterior à decisão vigente). Fora disso, a relação é INDETERMINADA.
 *
 * O texto do aviso nunca entra na conta, e nada daqui autoriza ação: estado e
 * ações vêm do estado atual (/api/me).
 */
export type RelacaoDoAviso = "VIGENTE" | "SUPERADA" | "ENVIO_ANTERIOR" | "INDETERMINADA";
export type VinculoDoAviso = "EXPLICITO" | "SEM_VINCULO";

export const TIPOS_DE_AVISO_DE_VERIFICACAO = new Set(["VERIFICACAO_APROVADA", "VERIFICACAO_REPROVADA"]);

/** Margem para relógios do app e do banco ao comparar só pelo tempo (avisos antigos). */
const MARGEM_MS = 60_000;

export type EnvioComDecisoes = {
  id: string;
  createdAt: Date;
  decididoEm: Date | null;
  decisoes: Array<{ id: string; decisao: string; createdAt: Date }>;
};

export type ContextoDoAviso = { relacao: RelacaoDoAviso; vinculo: VinculoDoAviso; decisaoDoAviso: Decisao | null };

function ultimaDecisao(envio: EnvioComDecisoes) {
  return [...envio.decisoes].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
}

/**
 * `envios` são SÓ os da conta dona do aviso (quem chama filtra por userId):
 * um vínculo que aponte para envio de outra conta simplesmente não é achado.
 */
export function relacaoDoAviso(
  aviso: { type: string; createdAt: Date; verificacaoId?: string | null; decisaoVerificacaoId?: string | null },
  envios: EnvioComDecisoes[],
): ContextoDoAviso {
  const indeterminada: ContextoDoAviso = { relacao: "INDETERMINADA", vinculo: "SEM_VINCULO", decisaoDoAviso: null };
  if (!TIPOS_DE_AVISO_DE_VERIFICACAO.has(aviso.type) || envios.length === 0) return indeterminada;
  const ordenados = [...envios].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const atual = ordenados[ordenados.length - 1];

  if (aviso.verificacaoId && aviso.decisaoVerificacaoId) {
    const envio = ordenados.find((e) => e.id === aviso.verificacaoId);
    const decisao = envio?.decisoes.find((d) => d.id === aviso.decisaoVerificacaoId);
    // Vínculo que não pertence a esta conta (ou não existe mais): não vale nada.
    if (!envio || !decisao) return indeterminada;
    const decisaoDoAviso = decisao.decisao as Decisao;
    if (envio.id !== atual.id) return { relacao: "ENVIO_ANTERIOR", vinculo: "EXPLICITO", decisaoDoAviso };
    return { relacao: ultimaDecisao(atual)?.id === decisao.id ? "VIGENTE" : "SUPERADA", vinculo: "EXPLICITO", decisaoDoAviso };
  }

  // Sem vínculo: só o que o tempo garante, e sem nomear a decisão.
  const t = aviso.createdAt.getTime();
  if (t < atual.createdAt.getTime()) return { relacao: "ENVIO_ANTERIOR", vinculo: "SEM_VINCULO", decisaoDoAviso: null };
  if (atual.decididoEm && t < atual.decididoEm.getTime() - MARGEM_MS) {
    return { relacao: "SUPERADA", vinculo: "SEM_VINCULO", decisaoDoAviso: null };
  }
  return indeterminada;
}
