import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { IncidenteGravidade, SafeScore, ScoreEventoTipo } from "@prisma/client";
import {
  applyEvent,
  aplicarEventoV2,
  buscarPoliticaAtiva,
  pesoDaPolitica,
  type PoliticaAtiva,
  type SafeScoreEventInput,
} from "@/lib/safeScore/applyEvent";
import { faixaDoScore } from "../../../shared/safescore/guia";

const SCORE_INICIAL = 500;

const PESOS_FIXOS: Partial<Record<ScoreEventoTipo, number>> = {
  SERVICO_CONCLUIDO: 5,
  KYC_APROVADO: 50,
  // Mesmo valor de `kyc_rejeitado` na política V2. Antes o tipo nem existia no
  // enum: a reprovação chamava com `as any`, o insert falhava e o `.catch`
  // engolia — reprovar KYC não mexia em ledger nenhum.
  KYC_REJEITADO: -20,
  DENUNCIA_ARQUIVADA: 10,
  CANCELAMENTO: -15,
  NO_SHOW: -25,
  TEMPO_PLATAFORMA: 3,
};

const PESO_DENUNCIA_CONFIRMADA: Record<IncidenteGravidade, number> = {
  BAIXA: -30,
  MEDIA: -80,
  ALTA: -150,
  CRITICA: -300,
};

function clampScore(score: number) {
  return Math.max(0, Math.min(1000, score));
}

function pesoAvaliacao(nota: number, tipo: ScoreEventoTipo) {
  if (tipo === "AVALIACAO_POSITIVA") {
    if (nota >= 5) return 15;
    if (nota >= 4) return 8;
    return 0;
  }
  if (nota <= 1) return -20;
  if (nota <= 2) return -10;
  return 0;
}

/**
 * Parâmetro do peso graduado no V2 para uma avaliação: a MESMA faixa que
 * `pesoAvaliacao` usa, e não a nota crua. Com isso a política ({"5","4","3"}
 * na positiva, {"3","2","1"} na negativa) cobre qualquer entrada exatamente
 * como o legado — inclusive nota ausente, que o legado trata como 0.
 */
function faixaDeNota(nota: number, tipo: ScoreEventoTipo): "1" | "2" | "3" | "4" | "5" {
  if (tipo === "AVALIACAO_POSITIVA") {
    if (nota >= 5) return "5";
    if (nota >= 4) return "4";
    return "3";
  }
  if (nota <= 1) return "1";
  if (nota <= 2) return "2";
  return "3";
}

export type EntradaDoPeso = { nota?: number; gravidade?: IncidenteGravidade };

/**
 * Peso do legado e o parâmetro que a política V2 usa para o MESMO evento.
 *
 * Pura: as buscas no banco ficam em `calcularPeso`. Os dois ledgers leem
 * nota/gravidade uma vez, do mesmo lugar — antes o V2 recebia só a descrição
 * e aplicava peso fixo, divergindo do legado em avaliação e denúncia.
 */
export function resolverPeso(
  tipo: ScoreEventoTipo,
  entrada: EntradaDoPeso = {},
): { peso: number; parametro?: string } {
  if (tipo === "AVALIACAO_POSITIVA" || tipo === "AVALIACAO_NEGATIVA") {
    const nota = entrada.nota !== undefined && Number.isFinite(entrada.nota) ? entrada.nota : 0;
    return { peso: pesoAvaliacao(nota, tipo), parametro: faixaDeNota(nota, tipo) };
  }

  if (tipo === "DENUNCIA_CONFIRMADA") {
    const gravidade = entrada.gravidade ?? "MEDIA";
    return { peso: PESO_DENUNCIA_CONFIRMADA[gravidade], parametro: gravidade };
  }

  return { peso: PESOS_FIXOS[tipo] ?? 0 };
}

async function calcularPeso(
  tipo: ScoreEventoTipo,
  referenciaId?: string,
  descricao?: string,
) {
  if (tipo === "AVALIACAO_POSITIVA" || tipo === "AVALIACAO_NEGATIVA") {
    const avaliacao = referenciaId
      ? await prisma.avaliacao.findUnique({
          where: { id: referenciaId },
          select: { notaGeral: true },
        })
      : null;
    const notaFromDescricao = descricao?.match(/nota=(\d+)/)?.[1];
    return resolverPeso(tipo, { nota: avaliacao?.notaGeral ?? Number(notaFromDescricao) });
  }

  if (tipo === "DENUNCIA_CONFIRMADA") {
    const incidente = referenciaId
      ? await prisma.incidentReport.findUnique({
          where: { id: referenciaId },
          select: { gravidade: true },
        })
      : null;
    const gravidade =
      incidente?.gravidade ??
      (descricao?.match(/gravidade=(\w+)/)?.[1] as IncidenteGravidade | undefined);
    return resolverPeso(tipo, { gravidade });
  }

  return resolverPeso(tipo);
}

export async function suspenderUsuario(userId: string, db: Prisma.TransactionClient = prisma) {
  await db.user.update({
    where: { id: userId },
    data: { status: "BLOQUEADO", emObservacao: true },
  });
}

/**
 * Tipo legado → chave da política V2. `Record` completo, e não `Partial`: um
 * tipo novo no enum sem chave aqui é erro de compilação, em vez de cair num
 * `toLowerCase()` que a política não conhece e virar delta 0 em silêncio.
 */
export const EVENT_TYPE_V2: Record<ScoreEventoTipo, string> = {
  AVALIACAO_POSITIVA: "avaliacao_positiva",
  AVALIACAO_NEGATIVA: "avaliacao_negativa",
  SERVICO_CONCLUIDO: "servico_concluido",
  KYC_APROVADO: "kyc_aprovado",
  KYC_REJEITADO: "kyc_rejeitado",
  DENUNCIA_CONFIRMADA: "denuncia_confirmada",
  DENUNCIA_ARQUIVADA: "denuncia_arquivada",
  CANCELAMENTO: "cancelamento_tardio",
  NO_SHOW: "no_show",
  TEMPO_PLATAFORMA: "tempo_plataforma",
  KYC_REVISAO: "kyc_revisao",
};

/**
 * Se `e` é a violação da constraint deste fato no legado, devolve o SafeScore
 * atual: o fato já tinha sido contado. Qualquer outro erro — inclusive P2002 de
 * outra unicidade — devolve null, e quem chamou relança.
 */
async function safeScoreSeFatoJaContado(
  e: unknown,
  userId: string,
  chaveIdempotencia: string,
): Promise<SafeScore | null> {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2002") return null;
  const atual = await prisma.safeScore.findUnique({ where: { userId } });
  if (!atual) return null;
  const evento = await prisma.scoreEvento.findUnique({
    where: { safeScoreId_chaveIdempotencia: { safeScoreId: atual.id, chaveIdempotencia } },
    select: { id: true },
  });
  return evento ? atual : null;
}

export type EventoPreparado = {
  userId: string;
  tipo: ScoreEventoTipo;
  referenciaId?: string;
  descricao?: string;
  peso: number;
  parametro?: string;
  /** Identidade do fato no legado: `tipo:referência` ("sem-ref" quando falta). */
  chaveIdempotencia: string;
};

async function prepararEvento(
  userId: string,
  tipo: ScoreEventoTipo,
  referenciaId?: string,
  descricao?: string,
): Promise<EventoPreparado> {
  const { peso, parametro } = await calcularPeso(tipo, referenciaId, descricao);
  return {
    userId,
    tipo,
    referenciaId,
    descricao,
    peso,
    parametro,
    chaveIdempotencia: `${tipo}:${referenciaId ?? "sem-ref"}`,
  };
}

/**
 * Entrada do V2 para o mesmo fato. A chave é a do legado prefixada pelo
 * usuário: o mesmo fato entra uma vez só em cada ledger, por mais que a chamada
 * se repita. Todo call-site de hoje passa referenciaId; sem ele, "sem-ref" faz
 * o tipo valer uma única vez por usuário.
 */
function entradaV2(evento: EventoPreparado): SafeScoreEventInput {
  return {
    userId: evento.userId,
    eventType: EVENT_TYPE_V2[evento.tipo],
    source: evento.tipo,
    sourceId: evento.referenciaId,
    idempotencyKey: `${evento.userId}:${evento.chaveIdempotencia}`,
    parametro: evento.parametro,
    payload: evento.descricao ? { descricao: evento.descricao } : undefined,
  };
}

/**
 * Grava o fato no legado, dentro de `tx`. Condicional à `chaveIdempotencia`:
 * se o SafeScore já tem esse fato, não escreve nada. A checagem vem antes do
 * insert porque, numa transação aberta pelo chamador, um P2002 abortaria também
 * o que ele já gravou; a constraint única cobre a corrida entre os dois.
 */
async function aplicarNoLegado(
  tx: Prisma.TransactionClient,
  evento: EventoPreparado,
): Promise<{ safeScore: SafeScore; jaContado: boolean }> {
  const existente = await tx.safeScore.findUnique({ where: { userId: evento.userId } });
  if (existente) {
    const fato = await tx.scoreEvento.findUnique({
      where: {
        safeScoreId_chaveIdempotencia: { safeScoreId: existente.id, chaveIdempotencia: evento.chaveIdempotencia },
      },
      select: { id: true },
    });
    if (fato) return { safeScore: existente, jaContado: true };
  }

  const current = await tx.safeScore.upsert({
    where: { userId: evento.userId },
    create: { userId: evento.userId, score: SCORE_INICIAL },
    update: {},
  });

  const score = clampScore(current.score + evento.peso);

  const safeScore = await tx.safeScore.update({
    where: { id: current.id },
    data: { score },
  });

  await tx.scoreEvento.create({
    data: {
      safeScoreId: current.id,
      tipo: evento.tipo,
      peso: evento.peso,
      referenciaId: evento.referenciaId,
      descricao: evento.descricao,
      chaveIdempotencia: evento.chaveIdempotencia,
    },
  });

  if (score < 400) {
    await tx.user.update({
      where: { id: evento.userId },
      data: { emObservacao: true },
    });
  }

  return { safeScore, jaContado: false };
}

/**
 * Registra um fato de score nos dois ledgers — escrita dupla da transição.
 *
 * 1. V2 PRIMEIRO, e sem engolir erro: o V2 é o lado autoritativo. Se ele não
 *    grava, a chamada falha. Idempotente pela chave — uma retentativa não soma
 *    de novo, e é ela que completa um legado que tenha falhado depois de um V2
 *    bem-sucedido.
 * 2. Legado depois, condicional à `chaveIdempotencia`.
 *
 * Retorna o SafeScore LEGADO: as leituras que ainda usam o legado (resolver de
 * incidentes) dependem dele até a etapa 3.
 */
export async function aplicarEvento(
  userId: string,
  tipo: ScoreEventoTipo,
  referenciaId?: string,
  descricao?: string,
): Promise<SafeScore> {
  const evento = await prepararEvento(userId, tipo, referenciaId, descricao);

  // ── 1. V2 — autoritativo ──────────────────────────────────────────────
  await applyEvent(entradaV2(evento));

  // ── 2. Legado + suspensão — condicional à chave do fato ───────────────
  return aplicarLegadoESuspensao(evento);
}

/**
 * Parte NÃO-atômica de um evento: legado (condicional à chave) e a
 * auto-suspensão abaixo de 200. Fica fora de qualquer transação que precise
 * ser curta — o V2 já é a fonte de verdade e já commitou quando isto roda.
 *
 * Extraída de `aplicarEvento` para ser reaproveitada por quem grava o V2
 * dentro da PRÓPRIA transação de status (`aplicarEventoV2NaTransacao`) sem
 * pagar aqui dentro o custo do legado — ver `confirmar/route.ts`: as ~10
 * queries a mais por usuário do legado, dentro da transação de status,
 * encostavam no timeout padrão do Prisma sob concorrência e derrubavam as
 * requisições perdedoras com erro de timeout em vez do 409 esperado.
 */
export async function aplicarLegadoESuspensao(evento: EventoPreparado): Promise<SafeScore> {
  let resultado: { safeScore: SafeScore; jaContado: boolean };
  try {
    resultado = await prisma.$transaction((tx) => aplicarNoLegado(tx, evento));
  } catch (e) {
    const existente = await safeScoreSeFatoJaContado(e, evento.userId, evento.chaveIdempotencia);
    if (!existente) throw e;
    resultado = { safeScore: existente, jaContado: true };
  }

  // Fato repetido não reavalia a suspensão: se um admin já desfez o bloqueio,
  // uma retentativa não pode reaplicá-lo. (Auto-suspensão < 200 continua só no
  // legado; o substituto no V2 é pré-requisito para remover a escrita legada.)
  if (!resultado.jaContado && resultado.safeScore.score < 200) {
    await suspenderUsuario(evento.userId);
  }

  return resultado.safeScore;
}

/**
 * O mesmo efeito de `aplicarEvento`, dentro da transação de quem chama: V2,
 * legado e suspensão sobem ou voltam junto com o que o chamador já gravou.
 *
 * Não trata P2002: numa transação aberta ele já abortou tudo. A corrida é
 * barrada antes — pelo CAS no status do chamador e pelas checagens de chave
 * em aplicarEventoV2 e aplicarNoLegado.
 *
 * ATENÇÃO: isto mantém legado + suspensão DENTRO da transação do chamador.
 * Numa transação que também faz um CAS de status sob concorrência real
 * (ex.: confirmar serviço), isso é o que estourava o timeout padrão do
 * Prisma — prefira `aplicarEventoV2NaTransacao` (só a parte atômica) seguido
 * de `aplicarLegadoESuspensao` depois do commit. Mantida como está para não
 * mudar de comportamento nenhum outro call-site que já a use.
 */
export async function aplicarEventoNaTransacao(
  tx: Prisma.TransactionClient,
  userId: string,
  tipo: ScoreEventoTipo,
  referenciaId?: string,
  descricao?: string,
): Promise<SafeScore> {
  const evento = await prepararEvento(userId, tipo, referenciaId, descricao);
  const politica = await buscarPoliticaAtiva(tx);

  await aplicarEventoV2(tx, entradaV2(evento), politica);
  const { safeScore, jaContado } = await aplicarNoLegado(tx, evento);

  if (!jaContado && safeScore.score < 200) {
    await suspenderUsuario(userId, tx);
  }

  return safeScore;
}

/**
 * Só a parte ATÔMICA de um evento V2, dentro da transação de quem chama.
 * Devolve o evento preparado para o chamador rodar `aplicarLegadoESuspensao`
 * depois do commit — sem isso, esta chamada sozinha NUNCA grava no legado
 * nem aplica a auto-suspensão.
 *
 * `politicaPreCarregada`: evita buscar a política uma vez por usuário quando
 * o chamador já a tem (ex.: confirmar serviço, que chama isto até 2 vezes na
 * mesma transação — cliente e profissional).
 */
export async function aplicarEventoV2NaTransacao(
  tx: Prisma.TransactionClient,
  userId: string,
  tipo: ScoreEventoTipo,
  referenciaId?: string,
  descricao?: string,
  politicaPreCarregada?: PoliticaAtiva,
): Promise<EventoPreparado> {
  const evento = await prepararEvento(userId, tipo, referenciaId, descricao);
  const politica = politicaPreCarregada ?? (await buscarPoliticaAtiva(tx));
  await aplicarEventoV2(tx, entradaV2(evento), politica);
  return evento;
}

export function getFaixa(score: number): {
  label: string;
  cor: string;
  bloqueado: boolean;
} {
  // Limites e rótulos vêm do módulo compartilhado com o app (guia "Como funciona").
  const { label, cor, bloqueado } = faixaDoScore(score);
  return { label, cor, bloqueado };
}

const KYC_TIPOS: ScoreEventoTipo[] = ["KYC_APROVADO", "KYC_REJEITADO", "KYC_REVISAO"];

/**
 * Efeito do KYC de UM envio no score, conforme a decisão VIGENTE do envio.
 *
 * Por que não basta "evento único por envio": aprovar (+50) e depois revisar
 * para reprovado deixava os +50 de pé — a idempotência da chave impedia a
 * correção. E uma reaprovação não pode somar outros +50.
 *
 * Regra: o efeito devido é o peso da decisão vigente (aprovado = peso de
 * `kyc_aprovado`, reprovado/reenvio = peso de `kyc_rejeitado`, pendente = 0).
 * A primeira decisão grava o evento de sempre, com a chave de sempre; cada
 * revisão grava um AJUSTE `KYC_REVISAO` com delta = devido − soma já gravada
 * para o envio. Assim, aprovar → reprovar → aprovar soma exatamente um +50.
 *
 * Pelo estado, não pela ação: rodar de novo (retentativa, clique repetido,
 * duas decisões fora de ordem) dá delta 0. Cada ledger trava a linha do score
 * da conta durante o cálculo, e a chave do ajuste leva a quantidade de eventos
 * já gravados — uma corrida não grava o mesmo ajuste duas vezes.
 */
export async function reconciliarKycDaVerificacao(verificacaoId: string, descricao?: string): Promise<void> {
  const v = await prisma.documentVerification.findUnique({ where: { id: verificacaoId }, select: { userId: true } });
  if (!v) return;
  const userId = v.userId;
  const tipoDoStatus = (status: string): ScoreEventoTipo | null =>
    status === "APPROVED" ? "KYC_APROVADO" : status === "REJECTED" ? "KYC_REJEITADO" : null;
  const payload = descricao ? { descricao } : undefined;

  // ── 1. V2 — autoritativo ──────────────────────────────────────────────
  await prisma.$transaction(async (tx) => {
    await tx.safeScoreProfile.createMany({ data: [{ userId, currentScore: SCORE_INICIAL }], skipDuplicates: true });
    await tx.$queryRaw`SELECT 1 FROM "SafeScoreProfile" WHERE "userId" = ${userId} FOR UPDATE`;
    const atual = await tx.documentVerification.findUniqueOrThrow({ where: { id: verificacaoId }, select: { status: true } });
    const tipo = tipoDoStatus(atual.status);
    const politica = await buscarPoliticaAtiva(tx);
    const eventos = await tx.safeScoreEvent.findMany({
      where: { userId, sourceId: verificacaoId, eventType: { in: KYC_TIPOS.map((t) => EVENT_TYPE_V2[t]) } },
      select: { delta: true },
    });
    if (eventos.length === 0) {
      if (!tipo) return;
      await aplicarEventoV2(tx, { userId, eventType: EVENT_TYPE_V2[tipo], source: tipo, sourceId: verificacaoId, idempotencyKey: `${userId}:${tipo}:${verificacaoId}`, payload }, politica);
      return;
    }
    const devido = tipo ? pesoDaPolitica(politica.weights, EVENT_TYPE_V2[tipo]) : 0;
    const delta = devido - eventos.reduce((soma, e) => soma + e.delta, 0);
    if (delta === 0) return;
    await aplicarEventoV2(
      tx,
      {
        userId,
        eventType: EVENT_TYPE_V2.KYC_REVISAO,
        source: "KYC_REVISAO",
        sourceId: verificacaoId,
        idempotencyKey: `${userId}:KYC_REVISAO:${verificacaoId}:${eventos.length}`,
        deltaFixo: delta,
        payload: { ...(payload ?? {}), decisao: tipo ?? "PENDENTE" },
      },
      politica,
    );
  });

  // ── 2. Legado + suspensão — mesma regra, pesos do legado ──────────────
  const legado = await prisma.$transaction(async (tx) => {
    // INSERT ... ON CONFLICT DO NOTHING: pedidos simultâneos não colidem ao criar.
    await tx.safeScore.createMany({ data: [{ userId, score: SCORE_INICIAL }], skipDuplicates: true });
    await tx.$queryRaw`SELECT 1 FROM "SafeScore" WHERE "userId" = ${userId} FOR UPDATE`;
    const ss = await tx.safeScore.findUniqueOrThrow({ where: { userId } });
    const atual = await tx.documentVerification.findUniqueOrThrow({ where: { id: verificacaoId }, select: { status: true } });
    const tipo = tipoDoStatus(atual.status);
    const eventos = await tx.scoreEvento.findMany({
      where: { safeScoreId: ss.id, referenciaId: verificacaoId, tipo: { in: KYC_TIPOS } },
      select: { peso: true },
    });
    if (eventos.length === 0) {
      if (!tipo) return null;
      const evento = await prepararEvento(userId, tipo, verificacaoId, descricao);
      return aplicarNoLegado(tx, evento);
    }
    const devido = tipo ? PESOS_FIXOS[tipo] ?? 0 : 0;
    const delta = devido - eventos.reduce((soma, e) => soma + e.peso, 0);
    if (delta === 0) return null;
    const lido = await tx.safeScore.findUniqueOrThrow({ where: { id: ss.id } });
    const score = clampScore(lido.score + delta);
    const safeScore = await tx.safeScore.update({ where: { id: ss.id }, data: { score } });
    await tx.scoreEvento.create({
      data: {
        safeScoreId: ss.id,
        tipo: "KYC_REVISAO",
        peso: delta,
        referenciaId: verificacaoId,
        descricao,
        chaveIdempotencia: `KYC_REVISAO:${verificacaoId}:${eventos.length}`,
      },
    });
    if (score < 400) await tx.user.update({ where: { id: userId }, data: { emObservacao: true } });
    return { safeScore, jaContado: false };
  });
  if (legado && !legado.jaContado && legado.safeScore.score < 200) {
    await suspenderUsuario(userId);
  }
}
