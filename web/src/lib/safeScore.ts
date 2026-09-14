import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { IncidenteGravidade, SafeScore, ScoreEventoTipo } from "@prisma/client";
import { applyEvent } from "@/lib/safeScore/applyEvent";

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

export async function suspenderUsuario(userId: string) {
  await prisma.user.update({
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

export async function aplicarEvento(
  userId: string,
  tipo: ScoreEventoTipo,
  referenciaId?: string,
  descricao?: string,
): Promise<SafeScore> {
  const { peso, parametro } = await calcularPeso(tipo, referenciaId, descricao);
  // Identidade do fato: a mesma do V2, sem o userId (o SafeScore já é do usuário).
  const chaveIdempotencia = `${tipo}:${referenciaId ?? "sem-ref"}`;

  // ── LEGADO ────────────────────────────────────────────────────────────
  // Idempotente: a constraint única (safeScoreId, chaveIdempotencia) faz a
  // segunda gravação do MESMO fato abortar esta transação inteira — inclusive
  // o score já somado. MUDANÇA DE COMPORTAMENTO, intencional: até aqui o legado
  // somava a cada chamada repetida.
  let updated: SafeScore;
  let jaContado = false;
  try {
    updated = await prisma.$transaction(async (tx) => {
      const current = await tx.safeScore.upsert({
        where: { userId },
        create: { userId, score: SCORE_INICIAL },
        update: {},
      });

      const score = clampScore(current.score + peso);

      const safeScore = await tx.safeScore.update({
        where: { id: current.id },
        data: { score },
      });

      await tx.scoreEvento.create({
        data: { safeScoreId: current.id, tipo, peso, referenciaId, descricao, chaveIdempotencia },
      });

      if (score < 400) {
        await tx.user.update({
          where: { id: userId },
          data: { emObservacao: true },
        });
      }

      return safeScore;
    });
  } catch (e) {
    const existente = await safeScoreSeFatoJaContado(e, userId, chaveIdempotencia);
    if (!existente) throw e;
    updated = existente;
    jaContado = true;
  }

  // Fato repetido não reavalia a suspensão: se um admin já desfez o bloqueio,
  // uma retentativa não pode reaplicá-lo.
  if (!jaContado && updated.score < 200) {
    await suspenderUsuario(userId);
  }
  // ── FIM LEGADO ────────────────────────────────────────────────────────

  // ── NOVO LEDGER: dual-write silencioso ───────────────────────────────
  // Falha aqui nunca quebra o fluxo principal
  try {
    // Chave determinística: o mesmo fato (usuário + tipo + referência) entra
    // no V2 uma vez só, por mais que a chamada se repita. Com `Date.now()` na
    // chave, cada repetição virava evento novo — o banco local tem um KYC
    // aprovado duas vezes para o mesmo documento, 5 s de diferença, somado
    // duas vezes. O legado acima continua somando a cada chamada; alinhar os
    // dois é a PR que troca o ledger.
    //
    // Todo call-site de hoje passa referenciaId. Sem ele, "sem-ref" faz o tipo
    // valer uma única vez por usuário — correto para fato único, e um limite a
    // lembrar se surgir evento recorrente sem referência.
    const idempotencyKey = `${userId}:${tipo}:${referenciaId ?? "sem-ref"}`;
    await applyEvent({
      userId,
      eventType: EVENT_TYPE_V2[tipo],
      source: tipo,
      sourceId: referenciaId,
      idempotencyKey,
      parametro,
      payload: descricao ? { descricao } : undefined,
    });
  } catch (err) {
    console.error("[SafeScore:dual-write] falha silenciosa:", err);
  }
  // ── FIM NOVO LEDGER ───────────────────────────────────────────────────

  return updated;
}

export function getFaixa(score: number): {
  label: string;
  cor: string;
  bloqueado: boolean;
} {
  if (score >= 800) return { label: "Confiança Máxima", cor: "#22c55e", bloqueado: false };
  if (score >= 600) return { label: "Confiável", cor: "#3b82f6", bloqueado: false };
  if (score >= 400) return { label: "Em Observação", cor: "#f59e0b", bloqueado: false };
  if (score >= 200) return { label: "Risco Alto", cor: "#ef4444", bloqueado: true };
  return { label: "Suspenso", cor: "#7f1d1d", bloqueado: true };
}
