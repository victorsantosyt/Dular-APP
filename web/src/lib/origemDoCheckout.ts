import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

/**
 * Prova de que uma sessão de checkout paga saiu da NOSSA rota autenticada, para
 * o usuário que ela diz ser (`client_reference_id`). Sem a prova, nenhum
 * vínculo é criado nem trocado: o `client_reference_id` é escrito por quem cria
 * a sessão, e um Payment Link aceita qualquer valor pela URL
 * (`?client_reference_id=`), copiando para a sessão os metadados FIXOS do link.
 *
 * Sessão NOVA: a rota grava a StripeOperacao `checkout` ANTES de criar a
 * sessão e põe a chave dela nos metadados da sessão e da assinatura
 * (`operacao`). A chave é aleatória e só existe no banco e no que a rota
 * escreveu na Stripe.
 *
 * Sessão LEGADA (criada pelo código anterior, sem operação), só até o marco
 * gravado pela migration, com folga para o build:
 *  - origem: não veio de Payment Link (`payment_link` nulo);
 *  - titularidade: o `customer_email` da sessão — que a rota anterior
 *    preenchia com o e-mail do usuário no banco — é o e-mail do usuário;
 *  - coerência: `metadata.userId` igual ao `client_reference_id`.
 * Metadados iguais, sozinhos, não provam nada: quem cria a sessão os escreve.
 */

export const MARCO_CHECKOUT_COM_OPERACAO = "checkout_com_operacao";
/** Folga depois do marco: sessões que o código anterior ainda criou durante o build e a troca de versão. */
export const FOLGA_DO_MARCO_MS = 60 * 60_000;

export type ProvaDeOrigem = { ok: true; via: "operacao" | "legado" } | { ok: false; motivo: string };

const recusa = (motivo: string): ProvaDeOrigem => ({ ok: false, motivo });

/** Operação `checkout` desta chave, do mesmo usuário e do mesmo plano. */
async function operacaoDoCheckout(chave: string, userId: string, planId: string | undefined) {
  const op = await prisma.stripeOperacao.findUnique({ where: { chave } });
  if (!op || op.tipo !== "checkout") return { op: null, motivo: "operacao_inexistente" };
  if (op.userId !== userId) return { op: null, motivo: "operacao_de_outro_usuario" };
  if (op.planId !== planId) return { op: null, motivo: "operacao_de_outro_plano" };
  return { op, motivo: null };
}

/** `checkout.session.completed` de assinatura. */
export async function provaDaSessao(session: Stripe.Checkout.Session): Promise<ProvaDeOrigem> {
  const userId = session.client_reference_id;
  const meta = (session.metadata ?? {}) as Record<string, string>;
  if (!userId) return recusa("sem_client_reference_id");
  if (meta.userId !== userId) return recusa("metadata_de_outro_usuario");

  if (meta.operacao) {
    const { op, motivo } = await operacaoDoCheckout(meta.operacao, userId, meta.planId);
    if (!op) return recusa(motivo!);
    if (op.referencia && op.referencia !== session.id) return recusa("operacao_de_outra_sessao");
    if (op.externalId && op.externalId !== idDe(session.subscription)) return recusa("operacao_de_outra_assinatura");
    return { ok: true, via: "operacao" };
  }

  const marco = await prisma.stripeMarco.findUnique({ where: { chave: MARCO_CHECKOUT_COM_OPERACAO } });
  if (!marco) return recusa("sem_marco_de_implantacao");
  const criada = typeof session.created === "number" ? session.created * 1000 : Number.NaN;
  if (!(criada < marco.em.getTime() + FOLGA_DO_MARCO_MS)) return recusa("sessao_nova_sem_operacao");
  if (session.payment_link) return recusa("payment_link");
  const usuario = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  const email = normalizarEmail(usuario?.email);
  if (!email || email !== normalizarEmail(session.customer_email)) return recusa("email_nao_confere");
  return { ok: true, via: "legado" };
}

/**
 * Primeira fatura paga ANTES do `completed`: só vincula se a ASSINATURA traz a
 * operação da rota (`subscription_data.metadata.operacao`) do mesmo usuário e
 * plano, E essa operação corresponde a esta `sub_` — já ligada a ela, ou a
 * sessão dela (relida na Stripe) é a que criou esta assinatura. Sem isso o
 * evento fica guardado e o `completed` decide, com a prova da sessão.
 */
export async function provaDaAssinatura(assinaturaId: string, meta: Record<string, string>): Promise<boolean> {
  if (!meta.operacao || !meta.userId) return false;
  const { op } = await operacaoDoCheckout(meta.operacao, meta.userId, meta.planId);
  if (!op) return false;
  if (op.externalId) return op.externalId === assinaturaId;
  if (!op.referencia) return false;
  try {
    const sessao = await stripe.checkout.sessions.retrieve(op.referencia);
    return idDe(sessao.subscription) === assinaturaId && sessao.client_reference_id === meta.userId;
  } catch (err) {
    if ((err as { code?: unknown })?.code === "resource_missing") return false;
    throw err;
  }
}

function idDe(valor: unknown): string | null {
  const id = typeof valor === "object" && valor !== null ? (valor as { id?: unknown }).id : valor;
  return typeof id === "string" ? id : null;
}

function normalizarEmail(email: string | null | undefined): string | null {
  const valor = email?.trim().toLowerCase();
  return valor ? valor : null;
}
