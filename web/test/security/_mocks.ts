// Silencia ruído de console em test runs quando LOG_LEVEL=silent.
// Mantém console.error para que falhas reais ainda apareçam.
if (process.env.LOG_LEVEL === "silent") {
  console.log = () => {};
  console.warn = () => {};
  console.info = () => {};
}

// Mocks compartilhados para testes de rota.
//
// Estratégia:
//  - `prisma.ts` usa `globalThis.prisma` como singleton. Setando aqui ANTES
//    de qualquer rota ser importada, a rota recebe o mock direto.
//  - JWT é real (signToken/verifyToken usando JWT_SECRET dummy).
//  - Stripe é mockado por env (STRIPE_SECRET_KEY=sk_test_dummy).

type AnyFn = (...args: any[]) => any;

export type MockPrisma = {
  user: { findUnique: AnyFn; findFirst: AnyFn; update: AnyFn; count: AnyFn; create: AnyFn; upsert: AnyFn };
  servico: { findUnique: AnyFn; count: AnyFn; create: AnyFn };
  avaliacaoEmpregador: { findUnique: AnyFn; create: AnyFn };
  incidentReport: { create: AnyFn };
  incidentAttachment: { create: AnyFn };
  chatRoom: { upsert: AnyFn };
  chatMessage: { findMany: AnyFn; updateMany: AnyFn; create: AnyFn };
  notification: { findMany: AnyFn; count: AnyFn; findUnique: AnyFn; update: AnyFn; updateMany: AnyFn };
  diaristaProfile: { findUnique: AnyFn; upsert: AnyFn };
  empregadorFavorito: { findMany: AnyFn; upsert: AnyFn; delete: AnyFn };
  montadorPerfil: { findUnique: AnyFn };
  documentVerification: { findFirst: AnyFn; create: AnyFn };
  subscription: { upsert: AnyFn; updateMany: AnyFn; findUnique: AnyFn };
  creditWallet: { upsert: AnyFn };
  creditTransaction: { create: AnyFn };
  auditLog: { create: AnyFn };
  featureLimit: { findUnique: AnyFn };
  userRestriction: { findMany: AnyFn };
  safeScoreProfile: { findUnique: AnyFn };
  safeScore: { findUnique: AnyFn };
  bairro: { findUnique: AnyFn };
  diaristaBairro: { findFirst: AnyFn };
  $queryRaw: AnyFn;
  $transaction: AnyFn;
};

function notMocked(label: string): AnyFn {
  return (async () => {
    throw new Error(`Prisma mock not configured: ${label}`);
  }) as AnyFn;
}

export function createMockPrisma(): MockPrisma {
  const mock: MockPrisma = {
    user: {
      findUnique: notMocked("user.findUnique"),
      findFirst: notMocked("user.findFirst"),
      update: notMocked("user.update"),
      count: notMocked("user.count"),
      create: notMocked("user.create"),
      upsert: notMocked("user.upsert"),
    },
    servico: {
      findUnique: notMocked("servico.findUnique"),
      count: notMocked("servico.count"),
      create: notMocked("servico.create"),
    },
    avaliacaoEmpregador: {
      findUnique: notMocked("avaliacaoEmpregador.findUnique"),
      create: notMocked("avaliacaoEmpregador.create"),
    },
    incidentReport: { create: notMocked("incidentReport.create") },
    incidentAttachment: { create: notMocked("incidentAttachment.create") },
    chatRoom: { upsert: notMocked("chatRoom.upsert") },
    chatMessage: {
      findMany: notMocked("chatMessage.findMany"),
      updateMany: notMocked("chatMessage.updateMany"),
      create: notMocked("chatMessage.create"),
    },
    notification: {
      findMany: notMocked("notification.findMany"),
      count: notMocked("notification.count"),
      findUnique: notMocked("notification.findUnique"),
      update: notMocked("notification.update"),
      updateMany: notMocked("notification.updateMany"),
    },
    diaristaProfile: {
      findUnique: notMocked("diaristaProfile.findUnique"),
      upsert: notMocked("diaristaProfile.upsert"),
    },
    empregadorFavorito: {
      findMany: notMocked("empregadorFavorito.findMany"),
      upsert: notMocked("empregadorFavorito.upsert"),
      delete: notMocked("empregadorFavorito.delete"),
    },
    montadorPerfil: {
      findUnique: notMocked("montadorPerfil.findUnique"),
    },
    documentVerification: {
      findFirst: notMocked("documentVerification.findFirst"),
      create: notMocked("documentVerification.create"),
    },
    subscription: {
      upsert: notMocked("subscription.upsert"),
      updateMany: notMocked("subscription.updateMany"),
      findUnique: notMocked("subscription.findUnique"),
    },
    creditWallet: { upsert: notMocked("creditWallet.upsert") },
    creditTransaction: { create: notMocked("creditTransaction.create") },
    auditLog: { create: notMocked("auditLog.create") },
    featureLimit: { findUnique: notMocked("featureLimit.findUnique") },
    userRestriction: { findMany: notMocked("userRestriction.findMany") },
    safeScoreProfile: { findUnique: notMocked("safeScoreProfile.findUnique") },
    safeScore: { findUnique: notMocked("safeScore.findUnique") },
    bairro: { findUnique: notMocked("bairro.findUnique") },
    diaristaBairro: { findFirst: notMocked("diaristaBairro.findFirst") },
    $queryRaw: notMocked("$queryRaw"),
    $transaction: (async (cb: any) => {
      if (typeof cb === "function") {
        return cb(mock);
      }
      return cb;
    }) as AnyFn,
  };
  return mock;
}

// Singleton instalado em globalThis.prisma. Cada teste deve substituir
// apenas os métodos que usa (`mockPrisma.user.findUnique = async () => ...`).
const g = globalThis as unknown as { prisma?: MockPrisma };
if (!g.prisma) {
  g.prisma = createMockPrisma();
}
export const mockPrisma = g.prisma as MockPrisma;

export function resetMockPrisma() {
  const fresh = createMockPrisma();
  for (const key of Object.keys(fresh) as Array<keyof MockPrisma>) {
    (mockPrisma as Record<string, unknown>)[key] = fresh[key] as unknown;
  }
}
