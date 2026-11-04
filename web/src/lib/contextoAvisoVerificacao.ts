import type { Decisao } from "@/lib/decisaoVerificacao";

/**
 * A que decisão de verificação um aviso se refere, e se ela ainda vale.
 *
 * O aviso (Notification) não guarda o id do envio nem da decisão: nasce na
 * mesma transação da DecisaoVerificacao (lib/decisaoVerificacao), então a
 * ligação é feita pelo instante, dentro de uma janela curta, e pelo tipo
 * (aprovado × reprovado/reenvio). O texto do aviso nunca entra na conta.
 *
 * - VIGENTE: a decisão do aviso é a última do envio mais recente;
 * - SUPERADA: mesmo envio, mas houve decisão posterior (revisão);
 * - ENVIO_ANTERIOR: o aviso é de um envio que já foi substituído;
 * - INDETERMINADA: não foi possível ligar com segurança. O app trata como
 *   histórico e mostra só o estado atual, sem instruir nenhuma ação.
 */
export type RelacaoDoAviso = "VIGENTE" | "SUPERADA" | "ENVIO_ANTERIOR" | "INDETERMINADA";

export const TIPOS_DE_AVISO_DE_VERIFICACAO = new Set(["VERIFICACAO_APROVADA", "VERIFICACAO_REPROVADA"]);

/** Decisão gravada até 60 s antes do aviso e no máximo 5 s depois (relógios do app e do banco). */
const JANELA_ANTES_MS = 60_000;
const JANELA_DEPOIS_MS = 5_000;

export type EnvioComDecisoes = {
  id: string;
  createdAt: Date;
  decididoEm: Date | null;
  decisoes: Array<{ id: string; decisao: string; createdAt: Date }>;
};

function compativel(tipo: string, decisao: string): boolean {
  if (tipo === "VERIFICACAO_APROVADA") return decisao === "APROVADO";
  if (tipo === "VERIFICACAO_REPROVADA") return decisao === "REPROVADO" || decisao === "REENVIO";
  return false;
}

export function relacaoDoAviso(
  aviso: { type: string; createdAt: Date },
  envios: EnvioComDecisoes[],
): { relacao: RelacaoDoAviso; decisaoDoAviso: Decisao | null } {
  if (!TIPOS_DE_AVISO_DE_VERIFICACAO.has(aviso.type) || envios.length === 0) {
    return { relacao: "INDETERMINADA", decisaoDoAviso: null };
  }
  const t = aviso.createdAt.getTime();
  const ordenados = [...envios].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const atual = ordenados[ordenados.length - 1];

  let melhor: { envio: EnvioComDecisoes; decisao: EnvioComDecisoes["decisoes"][number]; distancia: number } | null = null;
  for (const envio of ordenados) {
    for (const d of envio.decisoes) {
      if (!compativel(aviso.type, d.decisao)) continue;
      const delta = t - d.createdAt.getTime();
      if (delta > JANELA_ANTES_MS || delta < -JANELA_DEPOIS_MS) continue;
      const distancia = Math.abs(delta);
      if (!melhor || distancia < melhor.distancia) melhor = { envio, decisao: d, distancia };
    }
  }

  if (melhor) {
    const decisaoDoAviso = melhor.decisao.decisao as Decisao;
    if (melhor.envio.id !== atual.id) return { relacao: "ENVIO_ANTERIOR", decisaoDoAviso };
    const ultima = [...atual.decisoes].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    return { relacao: ultima?.id === melhor.decisao.id ? "VIGENTE" : "SUPERADA", decisaoDoAviso };
  }

  // Sem decisão correspondente (aviso anterior ao histórico de decisões):
  // só o que é seguro afirmar pelo tempo.
  if (t < atual.createdAt.getTime()) return { relacao: "ENVIO_ANTERIOR", decisaoDoAviso: null };
  if (atual.decididoEm && t < atual.decididoEm.getTime() - JANELA_ANTES_MS) {
    return { relacao: "SUPERADA", decisaoDoAviso: null };
  }
  return { relacao: "INDETERMINADA", decisaoDoAviso: null };
}
