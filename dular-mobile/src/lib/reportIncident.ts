/**
 * Regras puras do fluxo "Relatar incidente".
 *
 * Existem aqui, fora dos componentes, por dois motivos: para poderem ser
 * exercitadas com `node:test` (os arquivos de tela importam React Native e não
 * carregam), e porque o defeito que originou este módulo foi exatamente uma
 * regra de resolução escrita à mão dentro de uma tela.
 */

/**
 * Params da rota `ReportIncident`, definidos uma vez só.
 *
 * Os três navegadores declaravam coisas diferentes — dois diziam `undefined`
 * enquanto telas já passavam `{ servicoId }` —, então o TypeScript não protegia
 * nada justamente no fluxo que dependia do parâmetro.
 *
 * `serviceId` é a forma canônica. `servicoId` fica aceito por compatibilidade
 * com chamadas antigas; chamadas novas não devem usá-lo.
 */
export type ReportIncidentParams = {
  serviceId?: string;
  /** @deprecated use `serviceId`. */
  servicoId?: string;
  reportedUserId?: string;
  reportedUserName?: string;
  reportedUserAvatarUrl?: string | null;
};

/** Quem pode figurar como parte de um serviço. Só o que a UI precisa mostrar. */
export type ParteDoServico = {
  id: string;
  nome?: string | null;
  avatarUrl?: string | null;
};

/**
 * Escolhe a contraparte PELO ID que o backend já calculou, não pelo papel de
 * quem está olhando.
 *
 * A versão anterior perguntava "o cliente sou eu? então é a diarista; a
 * diarista sou eu? então é o cliente" — e não tinha ramo para montador. Num
 * serviço de montagem nenhum dos dois casava, a função devolvia `null` e a tela
 * mostrava "Usuário selecionado" no lugar do nome.
 *
 * `GET /api/servicos/{id}` devolve `otherUserId` calculado com
 * `montadorId ?? diaristaId`, já validando que quem pergunta participa do
 * serviço. Procurar esse id entre as partes cobre os três papéis de uma vez e
 * não duplica regra nenhuma.
 */
export function resolveCounterpartFromService(params: {
  otherUserId?: string | null;
  cliente?: ParteDoServico | null;
  diarista?: ParteDoServico | null;
  montador?: ParteDoServico | null;
}): ParteDoServico | null {
  const { otherUserId } = params;
  if (typeof otherUserId !== "string" || otherUserId.length === 0) return null;

  const candidatos = [params.cliente, params.diarista, params.montador].filter(
    (parte): parte is ParteDoServico => !!parte && typeof parte.id === "string" && parte.id.length > 0,
  );

  return candidatos.find((parte) => parte.id === otherUserId) ?? null;
}

/**
 * Qual conjunto de categorias de denúncia a pessoa vê.
 *
 * O empregador denuncia quem entrou na casa dele (patrimônio, comportamento,
 * segurança); o profissional denuncia quem o contratou (agressão, ambiente,
 * pagamento). Montador é profissional — antes caía no `else` e recebia a lista
 * do empregador.
 *
 * Papel ausente ou desconhecido continua no conjunto do empregador, que era o
 * comportamento anterior; mudar isso seria alterar caso não relacionado.
 */
export type ConjuntoDeCategorias = "EMPREGADOR" | "PROFISSIONAL";

export function conjuntoDeCategorias(role?: string | null): ConjuntoDeCategorias {
  const papel = String(role ?? "").toUpperCase();
  if (papel === "DIARISTA" || papel === "MONTADOR") return "PROFISSIONAL";
  return "EMPREGADOR";
}

// ── Decisão do SOS ──────────────────────────────────────────────────────────

/** Um serviço como `/api/servicos/minhas` devolve, no que interessa aqui. */
export type ServicoParaDenuncia = {
  id: string;
  clientId?: string | null;
  diaristaId?: string | null;
  montadorId?: string | null;
  tipo?: string | null;
  status?: string | null;
  cliente?: ParteDoServico | null;
  diarista?: ParteDoServico | null;
  montador?: ParteDoServico | null;
};

export type OpcaoDeDenuncia = {
  serviceId: string;
  contraparte: ParteDoServico;
  tipo: string | null;
  status: string | null;
};

export type DecisaoDeServico =
  | { tipo: "VAZIO" }
  | { tipo: "AUTOMATICO"; opcao: OpcaoDeDenuncia }
  | { tipo: "ESCOLHA"; opcoes: OpcaoDeDenuncia[] };

/**
 * Contraparte de um serviço da lista pessoal.
 *
 * Aqui não existe `otherUserId` — `/api/servicos/minhas` não o devolve —, então
 * a conta é feita com a MESMA fórmula do backend (`montadorId ?? diaristaId`),
 * e não com a cadeia cliente↔diarista que quebrava montador.
 *
 * Isto serve para LISTAR e MOSTRAR candidatos. A autoridade continua sendo o
 * servidor: qualquer `serviceId` escolhido aqui é revalidado em
 * `GET /api/servicos/{id}` e de novo em `POST /api/incidentes`.
 */
function contraparteDoServico(servico: ServicoParaDenuncia, meuUserId: string): ParteDoServico | null {
  const souOCliente = !!servico.clientId && servico.clientId === meuUserId;
  const profissional = servico.montador ?? servico.diarista ?? null;
  const parte = souOCliente ? profissional : servico.cliente ?? null;
  if (!parte || typeof parte.id !== "string" || parte.id.length === 0) return null;
  // Não faz sentido denunciar a si mesmo, e um serviço sem contraparte
  // atribuída (rascunho sem profissional) não tem quem denunciar.
  if (parte.id === meuUserId) return null;
  return parte;
}

/**
 * O que o SOS deve fazer quando a pessoa pede "denúncia formal" sem ter vindo
 * de um serviço.
 *
 * Só há auto-seleção com UM candidato. Com dois ou mais a escolha é da pessoa:
 * pegar `servicos[0]` seria apontar uma denúncia para alguém por ordem de
 * listagem. Com zero, a tela de denúncia não abre — abrir para mostrar
 * "Usuário não identificado" é o defeito que este trabalho corrige.
 *
 * Não há filtro por status: o backend aceita denúncia em qualquer status e um
 * incidente pode ser relatado depois do atendimento. O que elimina um serviço
 * da lista é não ter contraparte identificável, que é um fato dos dados, não
 * uma regra de status inventada aqui.
 *
 * A ordem recebida é preservada (a API já devolve `createdAt desc`).
 */
export function decidirServicoParaDenuncia(
  servicos: ServicoParaDenuncia[] | null | undefined,
  meuUserId?: string | null,
): DecisaoDeServico {
  if (!Array.isArray(servicos) || typeof meuUserId !== "string" || meuUserId.length === 0) {
    return { tipo: "VAZIO" };
  }

  const opcoes: OpcaoDeDenuncia[] = [];
  for (const servico of servicos) {
    if (!servico || typeof servico.id !== "string" || servico.id.length === 0) continue;
    const contraparte = contraparteDoServico(servico, meuUserId);
    if (!contraparte) continue;
    opcoes.push({
      serviceId: servico.id,
      contraparte,
      tipo: servico.tipo ?? null,
      status: servico.status ?? null,
    });
  }

  if (opcoes.length === 0) return { tipo: "VAZIO" };
  if (opcoes.length === 1) return { tipo: "AUTOMATICO", opcao: opcoes[0] };
  return { tipo: "ESCOLHA", opcoes };
}
