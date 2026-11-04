import { prisma } from "@/lib/prisma";
import { assinaturaEfetiva } from "@/lib/assinatura";
import { Prisma, type FeatureKey, type ServicoStatus } from "@prisma/client";

export type { FeatureKey };

export type FeatureAccess = {
  allowed: boolean;
  limit: number | null;
  used: number;
  plan: string;
  /** Janela em que `used` é contado (SOLICITACOES_MES: mês corrente do servidor). */
  periodo?: { inicio: string; fim: string };
};

export async function checkFeatureAccess(
  userId: string,
  feature: FeatureKey
): Promise<FeatureAccess> {
  // 1. Assinatura efetiva (vínculo Stripe + compras de loja) + role em paralelo.
  //
  // Só ACTIVE/TRIAL dentro do prazo valem; o resto cai para FREE. A validade
  // também conta, e essa era a rede que faltava: o status só muda quando chega
  // o aviso de cancelamento da loja ou do Stripe. Se esse aviso se perder, a
  // assinatura ficava ACTIVE para sempre e a pessoa mantinha acesso ilimitado
  // sem pagar. A regra fica em lib/assinatura (`assinaturaEfetiva`).
  const [efetiva, user] = await Promise.all([
    assinaturaEfetiva(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    }),
  ]);
  const plan = efetiva.plan;

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
  let periodo: FeatureAccess["periodo"];
  if (feature === "SOLICITACOES_MES") {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    periodo = { inicio: startOfMonth.toISOString(), fim: startOfNextMonth.toISOString() };

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
    ...(periodo ? { periodo } : {}),
  };
}
