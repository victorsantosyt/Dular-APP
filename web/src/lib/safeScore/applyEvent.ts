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
}

export type ApplyEventResult =
  | { status: 'applied'; newScore: number; delta: number }
  | { status: 'already_applied' }

export async function applyEvent(input: SafeScoreEventInput): Promise<ApplyEventResult> {
  const policy = await prisma.safeScorePolicyVersion.findFirst({
    where: { deprecatedAt: null },
    orderBy: { publishedAt: 'desc' },
  })
  if (!policy) throw new Error('SafeScore: nenhuma política ativa encontrada')

  const weights = policy.weights as Record<string, number>
  const delta = weights[input.eventType] ?? 0

  const profile = await prisma.safeScoreProfile.upsert({
    where: { userId: input.userId },
    update: {},
    create: { userId: input.userId, currentScore: 500 },
  })

  const scoreBefore = profile.currentScore
  const scoreAfter = Math.max(0, Math.min(1000, scoreBefore + delta))
  const newTier = scoreToTier(scoreAfter)

  try {
    await prisma.$transaction([
      prisma.safeScoreEvent.create({
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
      }),
      prisma.safeScoreProfile.update({
        where: { userId: input.userId },
        data: {
          currentScore: scoreAfter,
          tier: newTier,
          lastRecalcAt: new Date(),
        },
      }),
      prisma.user.update({
        where: { id: input.userId },
        data: {
          riskTier: newTier,
        },
      }),
    ])

    return { status: 'applied', newScore: scoreAfter, delta }
  } catch (e: unknown) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      return { status: 'already_applied' }
    }
    throw e
  }
}

function scoreToTier(score: number): 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' {
  if (score >= 850) return 'PLATINUM'
  if (score >= 650) return 'GOLD'
  if (score >= 400) return 'SILVER'
  return 'BRONZE'
}
