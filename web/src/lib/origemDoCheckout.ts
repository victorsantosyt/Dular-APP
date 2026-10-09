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
 * Sessão LEGADA (criada pelo código anterior, sem operação), só se criada
 * DENTRO de uma janela em que o código anterior pode ter estado no ar
 * (StripeJanelaLegado). A janela é registrada pelo build de produção que
 * terminou bem quando a produção respondeu com a saúde do código anterior —
 * primeira implantação, volta depois de rollback —, nunca pela migration (que
 * roda antes do build) e nunca num deploy comum (scripts/janela-legado-checkout.mjs).
 *  - começa em `desde`: a última presença VERIFICADA deste código em produção
 *    (o que foi criado enquanto ele servia não é legado);
 *  - nasce aberta e termina na primeira presença verificada deste código em
 *    produção depois dela (`ate`): a troca real, não o fim do build — a
 *    promoção pode atrasar horas (auto-atribuição desligada depois de um
 *    rollback) ou nunca acontecer. Aberta, vale no máximo LIMITE_DA_JANELA_ABERTA_MS;
 *  - vale até `ate` + folga: instâncias antigas terminando o que já atendiam.
 * Além da janela:
 *  - origem: não veio de Payment Link (`payment_link` nulo);
 *  - titularidade: o `customer_email` da sessão — que a rota anterior
 *    preenchia com o e-mail do usuário no banco — é o e-mail do usuário;
 *  - coerência: `metadata.userId` igual ao `client_reference_id`.
 * Metadados iguais, sozinhos, não provam nada: quem cria a sessão os escreve.
 */

/** Folga depois da troca real: instâncias do código anterior terminando o que já atendiam. */
export const FOLGA_DA_JANELA_MS = 60 * 60_000;
/** Janela que nenhuma presença verificada fechou vale no máximo isto a partir do build que a abriu. */
export const LIMITE_DA_JANELA_ABERTA_MS = 72 * 60 * 60_000;
/** StripeMarco: última presença deste código servindo (limite inferior da próxima janela). */
export const MARCO_PRESENCA = "presenca_checkout_com_operacao";

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

  const criada = typeof session.created === "number" ? session.created * 1000 : Number.NaN;
  if (!Number.isFinite(criada)) return recusa("sessao_sem_data");
  const janela = await prisma.stripeJanelaLegado.findFirst({
    where: {
      AND: [
        // `lte` deixa NULL de fora: a janela sem limite inferior entra pelo ramo explícito.
        { OR: [{ desde: null }, { desde: { lte: new Date(criada) } }] },
        {
          OR: [
            { ate: { gt: new Date(criada - FOLGA_DA_JANELA_MS) } },
            { ate: null, createdAt: { gt: new Date(criada - LIMITE_DA_JANELA_ABERTA_MS) } },
          ],
        },
      ],
    },
    select: { id: true },
  });
  if (!janela) return recusa("sessao_nova_sem_operacao");
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

/** Intervalo mínimo entre duas tentativas de presença no mesmo processo. Mutável só para os testes. */
export const limitesPresenca = { intervaloMs: 5 * 60_000, ultimaMs: 0, esperaSaudeMs: 3_000 };

/**
 * Esta instância é a produção? Na Vercel, uma implantação de produção roda
 * também sem ser a que está no ar (não promovida, ou a de antes de um
 * rollback). Por isso ela pergunta à produção quem está no ar (`/api/health`
 * devolve a `implantacao`) e só se reconhece se for ela mesma. Fora da Vercel
 * (local, testes) não há essa distinção; preview usa o banco de staging.
 */
async function souAProducao(): Promise<boolean> {
  const env = process.env;
  if (env.VERCEL_ENV !== "production") return env.VERCEL !== "1";
  const dominio = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const eu = env.VERCEL_DEPLOYMENT_ID;
  if (!dominio || !eu) return false;
  try {
    const resposta = await fetch(`https://${dominio}/api/health`, {
      signal: AbortSignal.timeout(limitesPresenca.esperaSaudeMs),
      headers: { "cache-control": "no-cache" },
    });
    if (!resposta.ok) return false;
    const corpo = (await resposta.json().catch(() => null)) as { implantacao?: unknown } | null;
    return corpo?.implantacao === eu;
  } catch {
    return false;
  }
}

/**
 * Este código está servindo a produção (checkout, webhook, varredura): grava a
 * presença e fecha as janelas de legado abertas — a troca real aconteceu. No
 * máximo uma tentativa por intervalo por processo; instância que não é a
 * produção não grava nada (não encurta a janela do código anterior). Falha
 * aqui não derruba quem chamou.
 */
export async function registrarPresenca(): Promise<void> {
  const agora = Date.now();
  if (agora - limitesPresenca.ultimaMs < limitesPresenca.intervaloMs) return;
  limitesPresenca.ultimaMs = agora;
  try {
    if (!(await souAProducao())) return;
    const em = new Date();
    await prisma.$transaction([
      prisma.stripeMarco.upsert({ where: { chave: MARCO_PRESENCA }, update: { em }, create: { chave: MARCO_PRESENCA, em } }),
      // Janela que começa no futuro não foi alcançada pela troca (só existe em teste).
      prisma.stripeJanelaLegado.updateMany({ where: { ate: null, OR: [{ desde: null }, { desde: { lte: em } }] }, data: { ate: em } }),
    ]);
  } catch (err) {
    limitesPresenca.ultimaMs = 0;
    console.error("[origem-checkout] presença não gravada; segue sem ela:", (err as { message?: unknown })?.message ?? err);
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
