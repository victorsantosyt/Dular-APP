import { prisma } from "@/lib/prisma";

/**
 * Casos de cobrança Stripe para revisão MANUAL (StripeRevisao). Nada aqui
 * estorna nem avisa ninguém fora do sistema: é a fila que a rota de operações
 * lista. A chave é única por fatura ou por sessão — reentrega do mesmo evento
 * não abre outro caso.
 */
export type CasoDeRevisao = {
  tipo: "renovacao_paga_da_substituida" | "checkout_sem_prova";
  chave: string;
  userId?: string | null;
  assinatura?: string | null;
  substituida?: string | null;
  faturaId?: string | null;
  sessaoId?: string | null;
  valor?: number | null;
  moeda?: string | null;
  motivo?: string | null;
};

/** Grava o caso uma vez só. Devolve se ele é novo. */
export async function registrarRevisao(caso: CasoDeRevisao): Promise<boolean> {
  const { count } = await prisma.stripeRevisao.createMany({ data: [caso], skipDuplicates: true });
  if (count > 0) console.error("[stripe-revisao] caso aberto para revisão manual:", caso.tipo, caso.chave);
  return count > 0;
}

export function revisoesAbertas(limite = 200) {
  return prisma.stripeRevisao.findMany({ where: { status: "aberta" }, orderBy: { createdAt: "asc" }, take: limite });
}
