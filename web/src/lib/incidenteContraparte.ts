import { isServiceParticipant } from "@/lib/requireAuth";

/** As três colunas de participação de um serviço. */
export type ServicoPartes = {
  /** `Servico.clientId` é NOT NULL no schema. */
  clientId: string;
  /** Nulo em serviço de montagem. */
  diaristaId?: string | null;
  /** Só é preenchido quando `tipo === MONTADOR`. */
  montadorId?: string | null;
};

/**
 * Resultado da resolução da contraparte de uma denúncia.
 *
 * É discriminado porque cada recusa significa uma coisa diferente e quem chama
 * precisa distinguir: faltou informar o atendimento, o atendimento não existe,
 * quem pede não participa dele, ou o alvo enviado não é a contraparte. Antes
 * tudo virava o mesmo 403 com a mesma frase — inclusive quando nenhum serviço
 * havia sido informado, e a mensagem dizia "Acesso negado ao serviço informado".
 */
export type ResolucaoDaContraparte =
  | { ok: true; reportedUserId: string }
  | {
      ok: false;
      motivo: "SEM_SERVICO" | "SERVICO_INEXISTENTE" | "NAO_PARTICIPANTE" | "CONTRAPARTE_INVALIDA";
    };

/**
 * Decide contra quem a denúncia será registrada.
 *
 * Puro de propósito: recebe o serviço já lido do banco, para que a regra de
 * permissão possa ser exercitada sem subir Postgres. Quem chama faz o
 * `findUnique` e passa o resultado (ou `null` se não achou).
 *
 * O `reportedUserId` que vem do cliente é tratado como sugestão: só é aceito se
 * for realmente a contraparte deste serviço. Denúncia contra terceiro de fora
 * do atendimento é recusada — falha fechada.
 */
export function resolverContraparte(params: {
  reporterId: string;
  reportedUserId?: string;
  serviceId?: string;
  servico: ServicoPartes | null;
}): ResolucaoDaContraparte {
  const { reporterId, reportedUserId, serviceId, servico } = params;

  if (!serviceId) return { ok: false, motivo: "SEM_SERVICO" };
  if (!servico) return { ok: false, motivo: "SERVICO_INEXISTENTE" };
  if (!isServiceParticipant(reporterId, servico)) return { ok: false, motivo: "NAO_PARTICIPANTE" };

  // Mesma fórmula do resto do sistema: o profissional de um serviço é o
  // montador OU a diarista, nunca os dois. Sem este ramo, denúncia de/para
  // montador não resolvia.
  const counterpartIds = (
    reporterId === servico.clientId ? [servico.montadorId, servico.diaristaId] : [servico.clientId]
  ).filter((id): id is string => typeof id === "string" && id.length > 0);

  if (reportedUserId) {
    return counterpartIds.includes(reportedUserId)
      ? { ok: true, reportedUserId }
      : { ok: false, motivo: "CONTRAPARTE_INVALIDA" };
  }

  const unico = counterpartIds[0];
  return unico ? { ok: true, reportedUserId: unico } : { ok: false, motivo: "CONTRAPARTE_INVALIDA" };
}

/**
 * Status HTTP e mensagem de cada recusa.
 *
 * "Não existe" e "existe mas não é seu" devolvem a MESMA resposta, de
 * propósito: separá-las deixaria descobrir quais ids de serviço existem
 * tentando um a um. O motivo continua distinto aqui dentro, para log e para
 * teste; só não vaza pela resposta.
 *
 * O que muda de verdade em relação ao comportamento anterior é o caso de
 * `serviceId` ausente: antes ele caía no mesmo 403 dizendo "Acesso negado ao
 * serviço informado", falando de um serviço que ninguém informou.
 */
export function respostaDeRecusa(
  motivo: Extract<ResolucaoDaContraparte, { ok: false }>["motivo"],
): { status: number; error: string } {
  if (motivo === "SEM_SERVICO") {
    return { status: 400, error: "Informe o atendimento (serviceId) ao qual o incidente se refere." };
  }
  if (motivo === "SERVICO_INEXISTENTE" || motivo === "NAO_PARTICIPANTE") {
    return { status: 403, error: "Atendimento não encontrado ou você não participa dele." };
  }
  return { status: 403, error: "A pessoa informada não é a contraparte deste atendimento." };
}
