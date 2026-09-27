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
  user: { findUnique: AnyFn; findFirst: AnyFn; update: AnyFn; updateMany: AnyFn; count: AnyFn; create: AnyFn; upsert: AnyFn };
  servico: { findUnique: AnyFn; count: AnyFn; create: AnyFn; update: AnyFn; updateMany: AnyFn };
  paymentInfo: { findUnique: AnyFn; upsert: AnyFn };
  paymentEvent: { create: AnyFn };
  pixSnapshot: { findUnique: AnyFn; create: AnyFn };
  avaliacaoEmpregador: { findUnique: AnyFn; create: AnyFn };
  incidentReport: { create: AnyFn };
  incidentAttachment: { create: AnyFn };
  chatRoom: { upsert: AnyFn; findUnique: AnyFn };
  chatRoomExclusao: { findFirst: AnyFn; createMany: AnyFn };
  chatMessage: { findMany: AnyFn; updateMany: AnyFn; create: AnyFn };
  notification: { findMany: AnyFn; count: AnyFn; findUnique: AnyFn; update: AnyFn; updateMany: AnyFn };
  diaristaProfile: { findUnique: AnyFn; upsert: AnyFn; findMany: AnyFn };
  empregadorFavorito: { findMany: AnyFn; upsert: AnyFn; delete: AnyFn };
  montadorPerfil: { findUnique: AnyFn; findMany: AnyFn };
  documentVerification: { findFirst: AnyFn; create: AnyFn };
  subscription: { upsert: AnyFn; updateMany: AnyFn; findUnique: AnyFn };
  creditWallet: { upsert: AnyFn };
  creditTransaction: { create: AnyFn };
  auditLog: { create: AnyFn };
  featureLimit: { findUnique: AnyFn };
  userRestriction: { findMany: AnyFn };
  safeScoreProfile: { findUnique: AnyFn; findMany: AnyFn };
  safeScore: { findUnique: AnyFn; findMany: AnyFn };
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
      /**
       * Único método com valor padrão em vez de `notMocked`.
       *
       * Toda rota autenticada passa por `assertContaAtiva`, que consulta
       * `user.findUnique` para conferir o status. Sem um padrão, todo teste
       * de rota teria de configurar esse mock só para não explodir num
       * detalhe que ele não está testando — e foi o que quebrou 14 suítes
       * quando a checagem entrou.
       *
       * O padrão é conta ATIVA, que é o caminho feliz. Teste que precise de
       * conta bloqueada ou removida sobrescreve, e teste que sobrescrever
       * para outra finalidade PRECISA incluir `status` — sem ele,
       * `assertContaAtiva` falha fechado e a suíte acusa. É o comportamento
       * desejado: mock sem status mascararia a checagem real.
       */
      findUnique: (async () => ({ status: "ATIVO" })) as AnyFn,
      findFirst: notMocked("user.findFirst"),
      update: notMocked("user.update"),
      updateMany: notMocked("user.updateMany"),
      count: notMocked("user.count"),
      create: notMocked("user.create"),
      upsert: notMocked("user.upsert"),
    },
    servico: {
      findUnique: notMocked("servico.findUnique"),
      count: notMocked("servico.count"),
      create: notMocked("servico.create"),
      update: notMocked("servico.update"),
      updateMany: notMocked("servico.updateMany"),
    },
    paymentInfo: {
      findUnique: notMocked("paymentInfo.findUnique"),
      upsert: notMocked("paymentInfo.upsert"),
    },
    paymentEvent: { create: notMocked("paymentEvent.create") },
    pixSnapshot: {
      findUnique: notMocked("pixSnapshot.findUnique"),
      create: notMocked("pixSnapshot.create"),
    },
    avaliacaoEmpregador: {
      findUnique: notMocked("avaliacaoEmpregador.findUnique"),
      create: notMocked("avaliacaoEmpregador.create"),
    },
    incidentReport: { create: notMocked("incidentReport.create") },
    incidentAttachment: { create: notMocked("incidentAttachment.create") },
    chatRoom: { upsert: notMocked("chatRoom.upsert"), findUnique: notMocked("chatRoom.findUnique") },
    chatRoomExclusao: {
      /**
       * Padrão = conversa NÃO excluída (null), pelo mesmo motivo do
       * `user.findUnique` acima: toda rota da sala de chat consulta a exclusão
       * antes de responder, e sem padrão cada teste de chat teria de mockar
       * isso só para não explodir. Teste de exclusão sobrescreve.
       */
      findFirst: (async () => null) as AnyFn,
      createMany: notMocked("chatRoomExclusao.createMany"),
    },
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
      findMany: notMocked("diaristaProfile.findMany"),
      upsert: notMocked("diaristaProfile.upsert"),
    },
    empregadorFavorito: {
      findMany: notMocked("empregadorFavorito.findMany"),
      upsert: notMocked("empregadorFavorito.upsert"),
      delete: notMocked("empregadorFavorito.delete"),
    },
    montadorPerfil: {
      findUnique: notMocked("montadorPerfil.findUnique"),
      findMany: notMocked("montadorPerfil.findMany"),
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
    safeScoreProfile: {
      findUnique: notMocked("safeScoreProfile.findUnique"),
      findMany: notMocked("safeScoreProfile.findMany"),
    },
    safeScore: {
      findUnique: notMocked("safeScore.findUnique"),
      findMany: notMocked("safeScore.findMany"),
    },
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
