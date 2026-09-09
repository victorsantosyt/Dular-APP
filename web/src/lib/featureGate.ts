import { prisma } from "@/lib/prisma";
import { Prisma, type FeatureKey, type ServicoStatus } from "@prisma/client";

export type { FeatureKey };

export type FeatureAccess = {
  allowed: boolean;
  limit: number | null;
  used: number;
  plan: string;
};

export async function checkFeatureAccess(
  userId: string,
  feature: FeatureKey
): Promise<FeatureAccess> {
  // 1. Subscription + role em paralelo
  const [subscription, user] = await Promise.all([
    prisma.subscription.findUnique({
      where: { userId },
      select: { plan: true, status: true, expiresAt: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    }),
  ]);

  // ACTIVE e TRIAL são planos válidos; CANCELED/EXPIRED caem para FREE.
  //
  // A validade também conta, e essa era a rede que faltava: o status só muda
  // quando chega o aviso de cancelamento da loja ou do Stripe. Se esse aviso se
  // perder — endpoint fora do ar, assinatura inválida, notificação não
  // reenviada —, a assinatura ficava ACTIVE para sempre e a pessoa mantinha
  // acesso ilimitado sem pagar, sem nada no sistema para desfazer isso.
  //
  // `expiresAt` nulo = sem prazo conhecido (é o caso de quem foi promovido na
  // mão pelo admin); aí vale o status, como antes.
  const statusValido =
    subscription?.status === "ACTIVE" || subscription?.status === "TRIAL";
  const dentroDoPrazo =
    !subscription?.expiresAt || subscription.expiresAt.getTime() > Date.now();
  const plan = subscription && statusValido && dentroDoPrazo ? subscription.plan : "FREE";

  // 2. Limite definido para esse plano + feature
  const featureLimit = await prisma.featureLimit.findUnique({
    where: { plan_feature: { plan, feature } },
    select: { limit: true, enabled: true },
  });

  // Sem registro de limite → libera sem restrição
  if (!featureLimit) {
    return { allowed: true, limit: null, used: 0, plan };
  }

  if (!featureLimit.enabled) {
    return { allowed: false, limit: featureLimit.limit ?? null, used: 0, plan };
  }

  // 3. Para SOLICITACOES_MES, conta serviços ativos no mês corrente
  let used = 0;
  if (feature === "SOLICITACOES_MES") {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const role = user?.role;

    // Cada papel conta o que ele de fato faz. O MONTADOR caía no ramo do
    // cliente e contava serviços onde ele é contratante — sempre zero, então
    // nunca seria limitado.
    const ehProfissional = role === "DIARISTA" || role === "MONTADOR";
    const escopoPorPapel =
      role === "DIARISTA"
        ? { diaristaId: userId }
        : role === "MONTADOR"
          ? { montadorId: userId }
          : { clientId: userId };

    // Para o PROFISSIONAL o limite é de serviços ACEITOS: o gate roda em
    // /aceitar. Contar SOLICITADO fazia a cota ser consumida por pedidos que
    // ele nunca aceitou — bastavam 5 solicitações de terceiros para travar o
    // mês inteiro de uma diarista no plano gratuito, sem ela fazer nada.
    // Para o EMPREGADOR o que conta é ter solicitado, então SOLICITADO entra.
    // Sem `as const`: o Prisma exige ServicoStatus[] mutável.
    const aceitosEmDiante: ServicoStatus[] = [
      "ACEITO",
      "EM_ANDAMENTO",
      "AGUARDANDO_FINALIZACAO",
      "CONCLUIDO",
      "CONFIRMADO",
      "FINALIZADO",
    ];
    const naoContam: ServicoStatus[] = ["CANCELADO", "RECUSADO", "RASCUNHO"];
    const statusQueContam: Prisma.ServicoWhereInput = ehProfissional
      ? { status: { in: aceitosEmDiante } }
      : { status: { notIn: naoContam } };

    used = await prisma.servico.count({
      where: {
        ...escopoPorPapel,
        ...statusQueContam,
        createdAt: { gte: startOfMonth, lt: startOfNextMonth },
      },
    });
  }

  // 4. limit null = ilimitado → sempre permitido
  const allowed = featureLimit.limit === null || used < featureLimit.limit;

  return {
    allowed,
    limit: featureLimit.limit ?? null,
    used,
    plan,
  };
}
