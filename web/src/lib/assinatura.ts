import { prisma } from "@/lib/prisma";
import { PLANS, validadeDoPlano, type PlanDef } from "@/lib/stripe";
import { SubscriptionStatus, type Prisma, type SubscriptionProvider } from "@prisma/client";

/**
 * Conceder e revogar assinatura — um lugar só, para os três provedores.
 *
 * Stripe, App Store e Google Play avisam por canais diferentes e com formatos
 * diferentes, mas o efeito no sistema é o mesmo: alguém passa a ter (ou deixa
 * de ter) um plano até uma data. Cada webhook traduz o seu recado para estas
 * duas funções, e a regra de acesso continua existindo em um lugar só.
 */

export type ConcessaoAssinatura = {
  userId: string;
  plano: PlanDef;
  provider: SubscriptionProvider;
  /** id da assinatura no provedor. Um por provedor — ver índice único. */
  externalId: string;
  /**
   * Fim do período pago, quando o provedor informa. A Apple e o Google mandam
   * `expiresDate` a cada renovação; o Stripe manda o fim do período no invoice.
   * Sem isso, calculamos pelo intervalo do plano.
   */
  expiraEm?: Date | null;
};

/**
 * Registra uma compra ou renovação.
 *
 * A validade vem do provedor quando ele informa. Antes era sempre "hoje + 1
 * mês", inclusive no plano ANUAL de R$ 359 — o campo não era lido por
 * ninguém, então o erro passava despercebido; agora que o acesso depende dele,
 * passaria a cortar o acesso 11 meses cedo.
 */
export async function concederAssinatura(dados: ConcessaoAssinatura) {
  const { userId, plano, provider, externalId, expiraEm } = dados;
  const expiresAt = expiraEm ?? validadeDoPlano(plano);

  return prisma.subscription.upsert({
    where: { userId },
    update: {
      plan: plano.plan,
      status: "ACTIVE",
      provider,
      externalId,
      storeProductId: provider === "STRIPE" ? null : plano.storeProductId,
      startedAt: new Date(),
      expiresAt,
      canceledAt: null,
    },
    create: {
      userId,
      plan: plano.plan,
      status: "ACTIVE",
      provider,
      externalId,
      storeProductId: provider === "STRIPE" ? null : plano.storeProductId,
      expiresAt,
    },
  });
}

/**
 * Encerra a assinatura identificada pelo provedor.
 *
 * `motivo` separa o que a pessoa pediu do que o pagamento causou: cancelamento
 * pedido vale até o fim do período já pago (não se tira o que foi pago), e
 * falha de pagamento corta na hora, porque o período seguinte não foi pago.
 */
export async function encerrarAssinatura(
  provider: SubscriptionProvider,
  externalId: string,
  motivo: "cancelada" | "nao_paga",
) {
  return prisma.subscription.updateMany({
    where: { provider, externalId },
    data: {
      status: motivo === "nao_paga" ? "EXPIRED" : "CANCELED",
      canceledAt: new Date(),
      // Cancelou: mantém até o fim do que pagou. Não pagou: acaba agora.
      ...(motivo === "nao_paga" ? { expiresAt: new Date() } : {}),
    },
  });
}

/**
 * Plano do catálogo a partir do que o Stripe guardou nos metadados.
 *
 * `planId` é o caminho certo — só ele diz o intervalo, e é o que separa o
 * mensal do anual. Mas quem PAGOU não pode ficar sem plano porque um metadado
 * faltou: uma sessão criada antes desta versão, ou um evento reprocessado com
 * payload antigo, ainda traz o `subscriptionPlan` (BASIC/PREMIUM). Nesse caso
 * caímos no mensal daquele nível — que é exatamente o que o código fazia antes
 * — em vez de recusar a concessão.
 */
export function planoDosMetadados(metadata: Record<string, string> | null | undefined) {
  const planId = metadata?.planId;
  if (planId && planId in PLANS) return PLANS[planId as keyof typeof PLANS];

  const nivel = metadata?.subscriptionPlan;
  if (nivel === "BASIC" || nivel === "PREMIUM") {
    const reserva = Object.values(PLANS).find(
      (p) => p.plan === nivel && p.interval === "month",
    );
    if (reserva) {
      console.warn(
        "[assinatura] sessão sem planId; usando o mensal de",
        nivel,
        "como reserva.",
      );
      return reserva;
    }
  }
  return null;
}

// ── Stripe: ordem e repetição dos eventos ───────────────────────────────────
//
// A Stripe não garante ordem nem entrega única: o `invoice.paid` da compra
// chega antes do `checkout.session.completed`, e qualquer evento pode ser
// reentregue. Por isso o Stripe não usa `concederAssinatura` (upsert que
// sempre reescreve) nem `encerrarAssinatura` (que regrava as datas com a hora
// do servidor).
//
// Cada evento de ciclo de vida é GUARDADO em StripeEventoAssinatura — o id do
// evento é a chave, então a mesma entrega duas vezes não grava nada — e o
// estado da linha é RECALCULADO a partir de `stripeBase` (o estado do vínculo
// antes de qualquer evento) e do CONJUNTO de eventos guardados da `sub_`, numa
// ordem canônica que não depende da ordem de chegada. Tudo que mexe numa `sub_`
// (eventos e completed) roda numa transação com o mesmo lock consultivo.

/** `created` e id do evento Stripe. */
export type EventoStripe = { quando: Date; eventId: string };

export type EstadoStripe = { status: SubscriptionStatus; expiresAt: Date | null; canceledAt: Date | null };

/**
 * Base do recálculo. A de linha anterior a esta mudança (`stripeBase` nulo) é
 * LEGADA: o estado dela já reflete as faturas até `periodoReconhecido` — o
 * `expiresAt` que ela tinha —, e a dobra não as aplica de novo.
 */
export type BaseStripe = EstadoStripe & { legado?: { periodoReconhecido: Date | null } };

export type TipoCicloStripe = "invoice.paid" | "invoice.payment_failed" | "customer.subscription.deleted";

/** Evento de ciclo de vida como fica guardado. Sem o id do evento: a ordem nunca depende dele. */
export type EventoCicloStripe = { tipo: string; criadoEm: Date; fimPeriodo: Date | null; faturaId: string | null };

function aplicarEventoStripe(estado: EstadoStripe, evento: EventoCicloStripe): EstadoStripe {
  switch (evento.tipo) {
    case "invoice.paid":
      // Excluída na Stripe é terminal: fatura paga depois disso não reativa.
      if (estado.status === "CANCELED") return estado;
      return { status: "ACTIVE", expiresAt: evento.fimPeriodo ?? estado.expiresAt, canceledAt: null };
    case "invoice.payment_failed":
      // O corte vale desde a PRIMEIRA falha aplicada.
      if (estado.status !== "ACTIVE") return estado;
      return { status: "EXPIRED", expiresAt: evento.criadoEm, canceledAt: evento.criadoEm };
    case "customer.subscription.deleted":
      // Cancelada vale até o fim do que foi pago: expiresAt mantido.
      if (estado.status === "CANCELED") return estado;
      return { status: "CANCELED", expiresAt: estado.expiresAt, canceledAt: evento.criadoEm };
    default:
      return estado;
  }
}

const porCriacao = (a: EventoCicloStripe, b: EventoCicloStripe) => a.criadoEm.getTime() - b.criadoEm.getTime();

/**
 * Período QUITADO: toda fatura dele tem ao menos um `invoice.paid`. Evento sem
 * `faturaId` é uma fatura própria — a paga se quita sozinha, a falha fica em aberto.
 */
function periodoQuitado(grupo: readonly EventoCicloStripe[]): boolean {
  const pagas = new Set(grupo.filter((e) => e.tipo === "invoice.paid").map((e) => e.faturaId));
  return grupo.every((e) => e.tipo === "invoice.paid" || (e.faturaId !== null && pagas.has(e.faturaId)));
}

/**
 * Estado da assinatura = base + CONJUNTO de eventos. Função pura: qualquer
 * ordem de chegada (ou de leitura) dos mesmos eventos dá o mesmo resultado, e o
 * id do evento nunca entra na ordem.
 *  0. Base legada com `periodoReconhecido`: evento de fatura sem período, ou com
 *     período até ali, já está no estado legado e é ignorado. Não é "maior
 *     validade sempre": depois da fronteira vale a regra normal, e a exclusão
 *     vale sempre.
 *  1. Eventos de fatura agrupados por período (`fimPeriodo`): null primeiro,
 *     depois crescente. A cronologia só desempata DENTRO do período.
 *  2. Período quitado: falhas e DEPOIS pagas (a paga venceu as tentativas que
 *     falharam). Não quitado: pagas e DEPOIS falhas (há fatura em aberto: falha
 *     FECHADO, o corte vale com o `created` da primeira falha aplicada).
 *  3. Exclusões por último: são terminais.
 * Dentro de cada tipo, `criadoEm` crescente; eventos que empatam no que a regra
 * olha têm efeito idêntico, então a ordem entre eles não muda o resultado.
 */
export function dobrarEventosStripe(base: BaseStripe, eventos: readonly EventoCicloStripe[]): EstadoStripe {
  const reconhecido = base.legado?.periodoReconhecido?.getTime() ?? null;
  const periodos = new Map<number | null, EventoCicloStripe[]>();
  const exclusoes: EventoCicloStripe[] = [];
  for (const e of eventos) {
    if (e.tipo === "customer.subscription.deleted") exclusoes.push(e);
    if (e.tipo !== "invoice.paid" && e.tipo !== "invoice.payment_failed") continue;
    const chave = e.fimPeriodo?.getTime() ?? null;
    if (reconhecido !== null && (chave === null || chave <= reconhecido)) continue;
    periodos.set(chave, [...(periodos.get(chave) ?? []), e]);
  }

  const ordemDosPeriodos = [...periodos.keys()].sort((a, b) => (a === null ? -1 : b === null ? 1 : a - b));
  let estado: EstadoStripe = { status: base.status, expiresAt: base.expiresAt, canceledAt: base.canceledAt };
  for (const chave of ordemDosPeriodos) {
    const grupo = periodos.get(chave)!;
    const pagas = grupo.filter((e) => e.tipo === "invoice.paid").sort(porCriacao);
    const falhas = grupo.filter((e) => e.tipo === "invoice.payment_failed").sort(porCriacao);
    estado = (periodoQuitado(grupo) ? [...falhas, ...pagas] : [...pagas, ...falhas]).reduce(aplicarEventoStripe, estado);
  }
  return exclusoes.sort(porCriacao).reduce(aplicarEventoStripe, estado);
}

const STATUS_VALIDOS: readonly string[] = Object.values(SubscriptionStatus);

function baseParaJson(base: BaseStripe): Prisma.InputJsonObject {
  return {
    status: base.status,
    expiresAt: base.expiresAt?.toISOString() ?? null,
    canceledAt: base.canceledAt?.toISOString() ?? null,
    ...(base.legado
      ? { origem: "legado", periodoReconhecido: base.legado.periodoReconhecido?.toISOString() ?? null }
      : {}),
  };
}

/** `stripeBase` gravado; null quando ausente ou malformado. */
function baseDoJson(valor: Prisma.JsonValue | null): BaseStripe | null {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) return null;
  const { status, expiresAt, canceledAt, origem, periodoReconhecido } = valor as Record<string, unknown>;
  if (typeof status !== "string" || !STATUS_VALIDOS.includes(status)) return null;
  const data = (v: unknown) => (v === null ? null : typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v) : undefined);
  const fim = data(expiresAt);
  const cancelada = data(canceledAt);
  if (fim === undefined || cancelada === undefined) return null;
  const estado: EstadoStripe = { status: status as SubscriptionStatus, expiresAt: fim, canceledAt: cancelada };
  if (origem !== "legado") return estado;
  const reconhecido = data(periodoReconhecido);
  return reconhecido === undefined ? null : { ...estado, legado: { periodoReconhecido: reconhecido } };
}

const mesmaData = (a: Date | null, b: Date | null) => (a === null || b === null ? a === b : a.getTime() === b.getTime());

/**
 * Limites (ms) da transação de assinatura Stripe. `lock_timeout` e
 * `statement_timeout` ficam abaixo do timeout do Prisma: um comando preso — à
 * espera do lock da `sub_` ou da linha travada por outra conexão — é cancelado
 * pelo próprio Postgres, a transação aborta e o rollback desfaz TUDO, inclusive
 * o evento já guardado. Mutável só para os testes encurtarem os tempos.
 */
export const limitesTransacaoStripe = {
  /** Espera por lock: o consultivo da `sub_` ou o de linha. */
  lockTimeoutMs: 2_000,
  /** Duração de cada comando. */
  statementTimeoutMs: 3_000,
  /** Prisma: espera por conexão livre no pool. */
  maxWaitMs: 2_000,
  /** Prisma: duração da transação inteira. */
  timeoutMs: 5_000,
};

/**
 * Transação de tudo que mexe nesta `sub_` (eventos e completed), serializada
 * pelo lock consultivo dela — inclusive antes de a linha existir. Solto no fim.
 */
async function naTransacaoDaAssinatura<T>(
  externalId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const { lockTimeoutMs, statementTimeoutMs, maxWaitMs, timeoutMs } = limitesTransacaoStripe;
  return prisma.$transaction(
    async (tx) => {
      // set_config(…, true) = SET LOCAL: vale só dentro desta transação.
      await tx.$executeRaw`SELECT set_config('lock_timeout', ${String(lockTimeoutMs)}, true), set_config('statement_timeout', ${String(statementTimeoutMs)}, true)`;
      // `$executeRaw`: o `$queryRaw` falha ao desserializar o `void` do pg_advisory_xact_lock.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(7702, hashtext(${externalId}))`;
      return fn(tx);
    },
    { maxWait: maxWaitMs, timeout: timeoutMs },
  );
}

/** Recalcula a linha da `sub_` e grava SÓ se o estado (ou a base) mudou. */
async function recalcularAssinaturaStripe(
  tx: Prisma.TransactionClient,
  externalId: string,
): Promise<"sem_linha" | "gravada" | "sem_mudanca"> {
  const linha = await tx.subscription.findFirst({
    where: { provider: "STRIPE", externalId },
    select: { id: true, status: true, expiresAt: true, canceledAt: true, stripeBase: true },
  });
  if (!linha) return "sem_linha";

  const eventos = await tx.stripeEventoAssinatura.findMany({
    where: { externalId },
    select: { tipo: true, criadoEm: true, fimPeriodo: true, faturaId: true },
  });
  // Linha anterior a esta mudança: a base é o estado atual — que já reflete as
  // faturas até o expiresAt dela —, gravada agora numa escrita só.
  const baseGravada = baseDoJson(linha.stripeBase);
  const base: BaseStripe = baseGravada ?? {
    status: linha.status,
    expiresAt: linha.expiresAt,
    canceledAt: linha.canceledAt,
    legado: { periodoReconhecido: linha.expiresAt },
  };
  const novo = dobrarEventosStripe(base, eventos);

  const igual =
    novo.status === linha.status && mesmaData(novo.expiresAt, linha.expiresAt) && mesmaData(novo.canceledAt, linha.canceledAt);
  if (baseGravada && igual) return "sem_mudanca";

  await tx.subscription.updateMany({
    // externalId no where: se o vínculo trocou de `sub_` no meio, nada é escrito.
    where: { id: linha.id, provider: "STRIPE", externalId },
    data: {
      status: novo.status,
      expiresAt: novo.expiresAt,
      canceledAt: novo.canceledAt,
      ...(baseGravada ? {} : { stripeBase: baseParaJson(base) }),
    },
  });
  return "gravada";
}

export type VinculoStripe = {
  userId: string;
  plano: PlanDef;
  /** `sub_…` */
  externalId: string;
  /** `created` do evento que cria ou troca o vínculo; vira o `startedAt`. */
  quando: Date;
};

/**
 * Cria o vínculo da pessoa com a assinatura Stripe, ou troca o que ela tem —
 * só se ele aponta para OUTRA coisa e começou até este evento — e recalcula
 * com os eventos já guardados da `sub_`. Se já aponta para esta mesma `sub_`,
 * nada é escrito. Devolve se criou ou trocou.
 */
async function vincularNaTransacao(tx: Prisma.TransactionClient, vinculo: VinculoStripe): Promise<boolean> {
  const { userId, plano, externalId, quando } = vinculo;
  const base: EstadoStripe = { status: "ACTIVE", expiresAt: validadeDoPlano(plano, quando), canceledAt: null };
  const dados = {
    plan: plano.plan,
    status: base.status,
    provider: "STRIPE" as const,
    externalId,
    storeProductId: null,
    startedAt: quando,
    expiresAt: base.expiresAt,
    canceledAt: base.canceledAt,
    stripeBase: baseParaJson(base),
  };

  // INSERT … ON CONFLICT DO NOTHING: duas criações simultâneas não colidem.
  const criada = await tx.subscription.createMany({ data: [{ userId, ...dados }], skipDuplicates: true });
  const vinculou =
    criada.count > 0 ||
    (
      await tx.subscription.updateMany({
        where: {
          userId,
          AND: [
            // `not` deixa NULL de fora: o externalId nulo entra pelo ramo explícito.
            { OR: [{ provider: { not: "STRIPE" } }, { externalId: null }, { externalId: { not: externalId } }] },
            { startedAt: { lte: quando } },
          ],
        },
        data: dados,
      })
    ).count > 0;

  // O `invoice.paid` costuma chegar ANTES do completed: entra aqui, sem reenvio.
  if (vinculou) await recalcularAssinaturaStripe(tx, externalId);
  return vinculou;
}

/** `checkout.session.completed`: cria ou troca o vínculo, sob o lock da `sub_`. */
export async function vincularAssinaturaStripe(vinculo: VinculoStripe): Promise<boolean> {
  return naTransacaoDaAssinatura(vinculo.externalId, (tx) => vincularNaTransacao(tx, vinculo));
}

export type EventoRecebidoStripe = {
  eventId: string;
  externalId: string;
  tipo: TipoCicloStripe;
  criadoEm: Date;
  /**
   * Fim do período da fatura: no invoice.paid, com o fallback já aplicado; no
   * invoice.payment_failed, o da fatura que falhou; null na exclusão.
   */
  fimPeriodo: Date | null;
  /** `in_…` nos eventos de fatura; null na exclusão. */
  faturaId: string | null;
};

export type ResultadoEventoStripe = "aplicado" | "sem_mudanca" | "repetido" | "guardado" | "sem_usuario";

/**
 * Evento de ciclo de vida, atômico: lock da `sub_`, deduplicação persistente
 * (mesma entrega → nada mais é escrito) e recálculo. Sem linha da `sub_`, só o
 * `vinculo` cria ou troca o vínculo — a rota o passa apenas na PRIMEIRA fatura
 * da assinatura; senão o evento fica guardado e o completed o aplica ao criar
 * o vínculo.
 */
export async function processarEventoStripe(
  evento: EventoRecebidoStripe,
  vinculo: Omit<VinculoStripe, "externalId" | "quando"> | null,
): Promise<ResultadoEventoStripe> {
  return naTransacaoDaAssinatura(evento.externalId, async (tx) => {
    const { count } = await tx.stripeEventoAssinatura.createMany({ data: [evento], skipDuplicates: true });
    if (count === 0) return "repetido";

    const recalculo = await recalcularAssinaturaStripe(tx, evento.externalId);
    if (recalculo !== "sem_linha") return recalculo === "gravada" ? "aplicado" : "sem_mudanca";

    if (!vinculo) return "guardado";
    const usuario = await tx.user.findUnique({ where: { id: vinculo.userId }, select: { id: true } });
    if (!usuario) return "sem_usuario";
    const vinculou = await vincularNaTransacao(tx, { ...vinculo, externalId: evento.externalId, quando: evento.criadoEm });
    return vinculou ? "aplicado" : "guardado";
  });
}
