import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export type SafeScoreEventInput = {
  userId: string
  eventType: string
  source: string
  sourceId?: string
  actorId?: string
  payload?: Record<string, unknown>
  idempotencyKey: string
  /**
   * Parâmetro dos pesos graduados da política: faixa de nota ("1".."5") ou
   * gravidade ("BAIXA".."CRITICA"). Ignorado quando a chave tem peso fixo.
   */
  parametro?: string
}

export type ApplyEventResult =
  | { status: 'applied'; newScore: number; delta: number }
  | { status: 'already_applied' }

const SCORE_INICIAL = 500

function temChave(obj: object, chave: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, chave)
}

/**
 * Peso de `eventType` em `SafeScorePolicyVersion.weights`.
 *
 * Cada chave vale OU um número fixo, OU um objeto {parametro: peso} para os
 * eventos que variam por nota ou gravidade. Chave ausente, objeto sem o
 * parâmetro, ou parâmetro não informado → 0: o evento é gravado com delta 0,
 * que já era o comportamento para chave desconhecida.
 */
export function pesoDaPolitica(weights: unknown, eventType: string, parametro?: string): number {
  if (!weights || typeof weights !== 'object' || !temChave(weights, eventType)) return 0
  const valor = (weights as Record<string, unknown>)[eventType]
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0
  if (valor && typeof valor === 'object' && parametro !== undefined && temChave(valor, parametro)) {
    const graduado = (valor as Record<string, unknown>)[parametro]
    return typeof graduado === 'number' && Number.isFinite(graduado) ? graduado : 0
  }
  return 0
}

export async function applyEvent(input: SafeScoreEventInput): Promise<ApplyEventResult> {
  const policy = await prisma.safeScorePolicyVersion.findFirst({
    where: { deprecatedAt: null },
    orderBy: { publishedAt: 'desc' },
  })
  if (!policy) throw new Error('SafeScore: nenhuma política ativa encontrada')

  const delta = pesoDaPolitica(policy.weights, input.eventType, input.parametro)

  try {
    return await prisma.$transaction(async (tx): Promise<ApplyEventResult> => {
      // INSERT ... ON CONFLICT DO NOTHING: duas transações criando o perfil ao
      // mesmo tempo não colidem — a segunda espera a primeira e não faz nada.
      await tx.safeScoreProfile.createMany({
        data: [{ userId: input.userId, currentScore: SCORE_INICIAL }],
        skipDuplicates: true,
      })

      // Incremento atômico. Antes o score era LIDO fora da transação e o valor
      // calculado era gravado por cima: dois eventos simultâneos liam o mesmo
      // número e um apagava o outro. O UPDATE trava a linha até o commit; a
      // transação concorrente espera e soma sobre o valor já gravado.
      const somado = await tx.safeScoreProfile.update({
        where: { userId: input.userId },
        data: { currentScore: { increment: delta } },
        select: { currentScore: true },
      })

      const scoreBefore = somado.currentScore - delta
      const scoreAfter = Math.max(0, Math.min(1000, somado.currentScore))
      const newTier = scoreToTier(scoreAfter)

      // Mesma linha, ainda travada por esta transação: grava o limite 0..1000
      // e o tier sem abrir janela para outro evento.
      await tx.safeScoreProfile.update({
        where: { userId: input.userId },
        data: { currentScore: scoreAfter, tier: newTier, lastRecalcAt: new Date() },
      })

      await tx.user.update({
        where: { id: input.userId },
        data: {
          riskTier: newTier,
        },
      })

      // Por último: se a chave já existe, o P2002 aborta a transação inteira e
      // o incremento acima é desfeito junto.
      await tx.safeScoreEvent.create({
        data: {
          idempotencyKey: input.idempotencyKey,
          userId: input.userId,
          policyVersionId: policy.id,
          scoreBefore,
          scoreAfter,
          delta,
          eventType: input.eventType,
          source: input.source,
          sourceId: input.sourceId,
          actorId: input.actorId,
          payload: (input.payload as Prisma.InputJsonObject) ?? undefined,
        },
      })

      return { status: 'applied', newScore: scoreAfter, delta }
    })
  } catch (e: unknown) {
    // P2002 só é "já aplicado" se for a chave DESTE evento. Outra violação de
    // unicidade não pode virar sucesso silencioso.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const existente = await prisma.safeScoreEvent.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        select: { id: true },
      })
      if (existente) return { status: 'already_applied' }
    }
    throw e
  }
}

export type ResultadoSemeadura =
  | { status: 'semeado'; perfilCriado: boolean; scoreAntes: number; scoreDepois: number; tier: string }
  | { status: 'sem_mudanca'; score: number }

/**
 * Define o score V2 de um usuário a partir de um valor que chega pronto — hoje
 * só o backfill do legado (scripts/safescore-backfill.ts). Não é evento de
 * negócio e não passa pela política.
 *
 * Mora aqui, e não no script, porque este módulo é o único escritor do perfil
 * V2 e de `User.riskTier` (teste estrutural em risk-band.test.ts).
 *
 * Deixa rastro no ledger: um SafeScoreEvent `backfill_legado` com o delta
 * efetivo. Assim "perfil = 500 + soma dos deltas" continua valendo e a origem
 * do número fica auditável. Idempotente: se o perfil já tem esse score e o
 * tier correspondente, não grava nada.
 */
export async function semearDoLegado(userId: string, scoreLegado: number): Promise<ResultadoSemeadura> {
  const alvo = Math.max(0, Math.min(1000, scoreLegado))
  const tierAlvo = scoreToTier(alvo)

  const policy = await prisma.safeScorePolicyVersion.findFirst({
    where: { deprecatedAt: null },
    orderBy: { publishedAt: 'desc' },
  })
  if (!policy) throw new Error('SafeScore: nenhuma política ativa encontrada')

  return prisma.$transaction(async (tx): Promise<ResultadoSemeadura> => {
    const existia = await tx.safeScoreProfile.findUnique({ where: { userId }, select: { id: true } })
    await tx.safeScoreProfile.createMany({
      data: [{ userId, currentScore: SCORE_INICIAL }],
      skipDuplicates: true,
    })

    // UPDATE que não muda nada: trava a linha e devolve o valor atual. Um
    // applyEvent concorrente espera este backfill terminar.
    const atual = await tx.safeScoreProfile.update({
      where: { userId },
      data: { currentScore: { increment: 0 } },
      select: { currentScore: true, tier: true },
    })

    if (atual.currentScore === alvo && atual.tier === tierAlvo) {
      return { status: 'sem_mudanca', score: alvo }
    }

    await tx.safeScoreProfile.update({
      where: { userId },
      data: { currentScore: alvo, tier: tierAlvo, lastRecalcAt: new Date() },
    })

    await tx.user.update({
      where: { id: userId },
      data: { riskTier: tierAlvo },
    })

    await tx.safeScoreEvent.create({
      data: {
        idempotencyKey: `backfill_legado:${userId}:${atual.currentScore}:${atual.tier}->${alvo}:${tierAlvo}`,
        userId,
        policyVersionId: policy.id,
        scoreBefore: atual.currentScore,
        scoreAfter: alvo,
        delta: alvo - atual.currentScore,
        eventType: 'backfill_legado',
        source: 'backfill',
        payload: { scoreLegado, perfilCriado: !existia, tierAnterior: atual.tier } as Prisma.InputJsonObject,
      },
    })

    return {
      status: 'semeado',
      perfilCriado: !existia,
      scoreAntes: atual.currentScore,
      scoreDepois: alvo,
      tier: tierAlvo,
    }
  })
}

export function scoreToTier(score: number): 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' {
  if (score >= 850) return 'PLATINUM'
  if (score >= 650) return 'GOLD'
  if (score >= 400) return 'SILVER'
  return 'BRONZE'
}
