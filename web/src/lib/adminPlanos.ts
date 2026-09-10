import { prisma } from "@/lib/prisma";
import { PLANS } from "@/lib/stripe";
import { checkFeatureAccess } from "@/lib/featureGate";
import type {
  FeatureKey,
  SubscriptionPlan,
  SubscriptionProvider,
  SubscriptionStatus,
} from "@prisma/client";

/**
 * Leitura do paywall para o painel. NADA aqui escreve.
 *
 * Motivo de existir: `checkFeatureAccess` trata "sem linha em FeatureLimit"
 * como liberado (featureGate.ts, o `if (!featureLimit)`). É a escolha certa —
 * um erro de dados não deve travar a operação inteira —, mas ela é silenciosa:
 * o paywall desligado se parece com o paywall funcionando. Esta camada existe
 * para que esse estado tenha nome e apareça.
 *
 * O limite NÃO se edita por aqui, por decisão: uma tela que desliga o paywall
 * em dois cliques é a mesma classe de superfície de AUTO_VERIFY_PROFILES.
 * Mudança de limite continua sendo migration, com revisão e histórico.
 */

/** Todas as chaves do enum FeatureKey (prisma/schema.prisma). */
const TODAS_AS_FEATURES: FeatureKey[] = [
  "SOLICITACOES_MES",
  "CHAT_ATIVO",
  "HISTORICO_COMPLETO",
  "SUPORTE_PRIORITARIO",
];

/**
 * As que o código realmente consulta. Verificado por varredura em src/: só
 * SOLICITACOES_MES aparece, em `checkFeatureAccess` e em
 * /api/servicos/[id]/aceitar. As outras três existem no enum e nenhum caminho
 * as lê — mostrá-las como gate ativo seria dizer que há uma trava onde não há.
 */
const FEATURES_APLICADAS: FeatureKey[] = ["SOLICITACOES_MES"];

/** Planos do enum SubscriptionPlan, na ordem em que se lê a escada. */
const TODOS_OS_PLANOS: SubscriptionPlan[] = ["FREE", "BASIC", "PREMIUM"];

export type EstadoDoGate =
  /** Linha existe e está habilitada — o limite realmente trava. */
  | "APLICADO"
  /** Sem linha: `checkFeatureAccess` devolve allowed:true. O paywall não barra ninguém. */
  | "AUSENTE"
  /** Linha com enabled:false — o gate NEGA sempre, mesmo dentro do limite. */
  | "DESABILITADO"
  /** A chave existe no enum e nenhum código a consulta. */
  | "NAO_IMPLEMENTADO";

export type LinhaDoGate = {
  plan: SubscriptionPlan;
  feature: FeatureKey;
  estado: EstadoDoGate;
  /** Limite aplicado de fato. null com estado APLICADO = ilimitado. */
  limiteAplicado: number | null;
  enabled: boolean | null;
  /** O que o catálogo (lib/stripe.ts) vende como esse plano. */
  catalogo: { nomes: string[]; descricoes: string[] } | null;
  /** Limite que a descrição do catálogo anuncia, quando dá para lê-lo. */
  limiteAnunciado: number | null;
  /** false = a descrição não declara número nem "ilimitado"; não dá para comparar. */
  anuncioLegivel: boolean;
  /** true quando o anunciado é legível e diverge do aplicado. */
  divergente: boolean;
};

export type DiagnosticoDoGate = {
  linhas: LinhaDoGate[];
  totalLinhasNoBanco: number;
  ausentes: number;
  desabilitados: number;
  divergentes: number;
  naoImplementados: number;
};

/**
 * Lê o limite anunciado na descrição do plano. Narrow de propósito: reconhece
 * "até N" e "ilimitado". Qualquer outra redação devolve ilegível em vez de
 * chutar — dizer "não sei comparar" é melhor do que afirmar que bate.
 */
export function limiteAnunciado(descricao: string): {
  valor: number | null;
  legivel: boolean;
} {
  const ate = descricao.match(/at[ée]\s+(\d+)/i);
  if (ate) return { valor: Number(ate[1]), legivel: true };
  if (/ilimitad/i.test(descricao)) return { valor: null, legivel: true };
  return { valor: null, legivel: false };
}

/** Itens do catálogo que entregam um dado plano. FREE não tem item: é a ausência de assinatura. */
function catalogoDoPlano(plan: SubscriptionPlan) {
  const itens = Object.values(PLANS).filter((p) => p.plan === plan);
  if (itens.length === 0) return null;
  return {
    nomes: [...new Set(itens.map((p) => p.name))],
    descricoes: [...new Set(itens.map((p) => p.description))],
  };
}

export async function diagnosticarGate(): Promise<DiagnosticoDoGate> {
  const noBanco = await prisma.featureLimit.findMany({
    select: { plan: true, feature: true, limit: true, enabled: true },
  });

  const porChave = new Map(noBanco.map((r) => [`${r.plan}::${r.feature}`, r]));
  const linhas: LinhaDoGate[] = [];

  for (const feature of TODAS_AS_FEATURES) {
    const implementada = FEATURES_APLICADAS.includes(feature);

    for (const plan of TODOS_OS_PLANOS) {
      const row = porChave.get(`${plan}::${feature}`);
      const catalogo = catalogoDoPlano(plan);

      // Uma chave que nenhum código lê não tem "estado do gate" — não há gate.
      // Mostrar AUSENTE aqui sugeriria uma trava que ninguém tentou aplicar.
      if (!implementada) {
        linhas.push({
          plan,
          feature,
          estado: "NAO_IMPLEMENTADO",
          limiteAplicado: row?.limit ?? null,
          enabled: row?.enabled ?? null,
          catalogo,
          limiteAnunciado: null,
          anuncioLegivel: false,
          divergente: false,
        });
        continue;
      }

      const estado: EstadoDoGate = !row
        ? "AUSENTE"
        : row.enabled === false
          ? "DESABILITADO"
          : "APLICADO";

      // O anúncio só existe para plano que está no catálogo. Descrições
      // diferentes para o mesmo plano (mensal e anual do Pro) só são
      // comparáveis quando todas anunciam o mesmo limite.
      let anunciado: number | null = null;
      let legivel = false;
      if (catalogo) {
        const lidos = catalogo.descricoes.map(limiteAnunciado);
        const todosLegiveis = lidos.every((l) => l.legivel);
        const valores = [...new Set(lidos.map((l) => l.valor))];
        if (todosLegiveis && valores.length === 1) {
          anunciado = valores[0];
          legivel = true;
        }
      }

      const aplicado = row?.limit ?? null;
      const divergente =
        estado === "APLICADO" && legivel && anunciado !== aplicado;

      linhas.push({
        plan,
        feature,
        estado,
        limiteAplicado: aplicado,
        enabled: row?.enabled ?? null,
        catalogo,
        limiteAnunciado: anunciado,
        anuncioLegivel: legivel,
        divergente,
      });
    }
  }

  return {
    linhas,
    totalLinhasNoBanco: noBanco.length,
    ausentes: linhas.filter((l) => l.estado === "AUSENTE").length,
    desabilitados: linhas.filter((l) => l.estado === "DESABILITADO").length,
    divergentes: linhas.filter((l) => l.divergente).length,
    naoImplementados: linhas.filter((l) => l.estado === "NAO_IMPLEMENTADO").length,
  };
}

// ─── Assinaturas ────────────────────────────────────────────────────────────

export type FiltroAssinaturas = {
  status?: SubscriptionStatus;
  provider?: SubscriptionProvider;
  pagina?: number;
  porPagina?: number;
};

export type LinhaAssinatura = {
  id: string;
  userId: string;
  nome: string | null;
  email: string | null;
  role: string | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  provider: SubscriptionProvider;
  storeProductId: string | null;
  startedAt: Date;
  expiresAt: Date | null;
  canceledAt: Date | null;
};

export type PaginaAssinaturas = {
  linhas: LinhaAssinatura[];
  total: number;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
};

const POR_PAGINA_PADRAO = 25;
const POR_PAGINA_MAX = 100;

export async function listarAssinaturas(
  filtro: FiltroAssinaturas = {}
): Promise<PaginaAssinaturas> {
  const porPagina = Math.min(
    Math.max(1, filtro.porPagina ?? POR_PAGINA_PADRAO),
    POR_PAGINA_MAX
  );
  const pagina = Math.max(1, filtro.pagina ?? 1);

  const where = {
    ...(filtro.status ? { status: filtro.status } : {}),
    ...(filtro.provider ? { provider: filtro.provider } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.subscription.count({ where }),
    prisma.subscription.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
      select: {
        id: true,
        userId: true,
        plan: true,
        status: true,
        provider: true,
        storeProductId: true,
        startedAt: true,
        expiresAt: true,
        canceledAt: true,
        user: { select: { nome: true, email: true, role: true } },
      },
    }),
  ]);

  return {
    linhas: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      nome: r.user?.nome ?? null,
      email: r.user?.email ?? null,
      role: r.user?.role ?? null,
      plan: r.plan,
      status: r.status,
      provider: r.provider,
      storeProductId: r.storeProductId,
      startedAt: r.startedAt,
      expiresAt: r.expiresAt,
      canceledAt: r.canceledAt,
    })),
    total,
    pagina,
    porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
  };
}

// ─── Uso corrente contra o limite ───────────────────────────────────────────

export type UsoDoProfissional = {
  userId: string;
  nome: string | null;
  role: string | null;
  plan: string;
  usado: number;
  limite: number | null;
  permitido: boolean;
};

/**
 * Uso do mês contra o limite, para quem tem assinatura viva.
 *
 * Chama `checkFeatureAccess` uma vez por pessoa em vez de repetir a contagem
 * aqui. É mais consulta ao banco do que um group by, e é de propósito: a regra
 * de o que conta como serviço usado é cheia de exceção por papel e por status
 * (o profissional conta aceitos, o empregador conta solicitados) e já mudou
 * uma vez. Reimplementar aqui garante que as duas versões divirjam em silêncio,
 * e aí o painel passa a mentir justamente sobre o número que interessa.
 * A lista é paginada, então o custo fica limitado à página.
 */
export async function usoContraLimite(
  userIds: string[]
): Promise<UsoDoProfissional[]> {
  if (userIds.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, nome: true, role: true },
  });
  const porId = new Map(users.map((u) => [u.id, u]));

  const resultados = await Promise.all(
    userIds.map(async (userId) => {
      const acesso = await checkFeatureAccess(userId, "SOLICITACOES_MES");
      const u = porId.get(userId);
      return {
        userId,
        nome: u?.nome ?? null,
        role: u?.role ?? null,
        plan: acesso.plan,
        usado: acesso.used,
        limite: acesso.limit,
        permitido: acesso.allowed,
      };
    })
  );

  return resultados;
}
