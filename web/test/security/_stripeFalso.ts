import { PLANS, type PlanDef } from "../../src/lib/stripe";

/**
 * Stripe SIMULADA em memória para os testes de troca de plano — nenhuma
 * chamada de rede. Reproduz o comportamento documentado que a troca usa:
 *
 *  - chave de idempotência: mesma chave + mesmos parâmetros devolvem a resposta
 *    guardada; parâmetros diferentes são recusados; a mesma chave em voo ao
 *    mesmo tempo é recusada (409);
 *  - `payment_behavior=pending_if_incomplete` + `always_invoice`: fatura de
 *    troca na hora; paga → item e metadados mudam juntos; recusada ou com
 *    autenticação → `pending_update`, nada aplicado até a fatura ser paga;
 *  - anular a fatura da troca pendente desfaz a pendência; nova troca substitui;
 *  - agenda (`from_subscription`, fases com metadados, `release`);
 *  - sessão de checkout aberta / paga / expirada.
 *
 * Toda fatura PAGA entra em `cobrancas`: é a prova de "cobrou uma vez só".
 */

type Intervalo = "month" | "year";
type Preco = { id: string; unit_amount: number; interval: Intervalo; product: string; lookup_key: string | null };
type Linha = { start: number; end: number; amount: number };
type Fatura = {
  id: string; sub: string; status: "open" | "paid" | "void"; billing_reason: string;
  amount: number; linhas: Linha[]; metadata: Record<string, string>;
};
type Pendente = { preco: string; metadata: Record<string, string>; fatura: string; expires_at: number };
type Assinatura = {
  id: string; customer: string; status: string; metadata: Record<string, string>; itemId: string; preco: string;
  inicio: number; fim: number; pending: Pendente | null; schedule: string | null; latest_invoice: string | null;
  cancel_at_period_end: boolean;
};
type Fase = { start_date: number; end_date: number; items: Array<{ price: string; quantity: number }>; metadata: Record<string, string> };
type Agenda = { id: string; sub: string; status: "active" | "released"; phases: Fase[]; atual: number };
type Sessao = { id: string; status: "open" | "complete" | "expired"; params: Record<string, any>; sub: string | null };
export type Cartao = "ok" | "falha" | "3ds";

const DIA = 86_400;
const duracao = (i: Intervalo) => (i === "year" ? 365 : 30) * DIA;

function erro(tipo: string, statusCode: number, code: string, message: string) {
  return Object.assign(new Error(message), { type: tipo, statusCode, code });
}

let instancias = 0;

export function criarStripeFalso(inicio = 1_790_000_000) {
  let seq = 0;
  // Ids únicos entre instâncias: o banco tem índice único por (provider, externalId).
  const instancia = `${Date.now().toString(36)}${(++instancias).toString(36)}`;
  const id = (p: string) => `${p}_falso${instancia}x${(++seq).toString().padStart(4, "0")}`;
  const s = {
    agora: inicio,
    assinaturas: new Map<string, Assinatura>(),
    faturas: new Map<string, Fatura>(),
    precos: new Map<string, Preco>(),
    produtos: new Set<string>(),
    agendas: new Map<string, Agenda>(),
    sessoes: new Map<string, Sessao>(),
    cartoes: new Map<string, Cartao>(),
    /** Faturas pagas, na ordem: cada uma é uma cobrança. */
    cobrancas: [] as Array<{ fatura: string; sub: string; valor: number; motivo: string }>,
    /** Chamadas de ESCRITA recebidas (método + chave de idempotência). */
    escritas: [] as string[],
    /** Antes de responder uma escrita: permite segurar/derrubar no meio. */
    antesDeResponder: null as null | ((metodo: string) => Promise<void>),
    /** Assinatura desconhecida: devolve dono e status para criá-la (testes de evento). */
    externas: null as null | ((subId: string) => { userId: string; paga: boolean } | null),
  };
  const cache = new Map<string, { metodo: string; params: string; resposta: unknown }>();
  const emVoo = new Set<string>();

  async function idempotente<T>(metodo: string, params: unknown, opcoes: { idempotencyKey?: string } | undefined, fn: () => T): Promise<T> {
    const chave = opcoes?.idempotencyKey;
    s.escritas.push(`${metodo}${chave ? ` ${chave}` : ""}`);
    const texto = JSON.stringify(params ?? {});
    if (chave) {
      const salvo = cache.get(chave);
      if (salvo) {
        if (salvo.metodo !== metodo || salvo.params !== texto) {
          throw erro("StripeIdempotencyError", 400, "idempotency_error", "Keys for idempotent requests can only be used with the same parameters");
        }
        return structuredClone(salvo.resposta) as T;
      }
      if (emVoo.has(chave)) throw erro("StripeIdempotencyError", 409, "idempotency_key_in_use", "idempotency key in use");
      emVoo.add(chave);
    }
    try {
      await Promise.resolve();
      const resposta = fn();
      if (chave) cache.set(chave, { metodo, params: texto, resposta: structuredClone(resposta) });
      if (s.antesDeResponder) await s.antesDeResponder(metodo);
      return resposta;
    } finally {
      if (chave) emVoo.delete(chave);
    }
  }

  // ── objetos no formato da Stripe ──
  const precoObj = (pid: string) => {
    const p = s.precos.get(pid)!;
    return { id: p.id, object: "price", unit_amount: p.unit_amount, recurring: { interval: p.interval }, product: p.product, lookup_key: p.lookup_key, active: true };
  };
  function faturaObj(fid: string) {
    const f = s.faturas.get(fid)!;
    return {
      id: f.id, object: "invoice", status: f.status, billing_reason: f.billing_reason,
      amount_due: f.amount, amount_paid: f.status === "paid" ? f.amount : 0, total: f.amount, currency: "brl",
      hosted_invoice_url: f.status === "open" ? `https://invoice.stripe.test/${f.id}` : null,
      metadata: {},
      parent: { type: "subscription_details", subscription_details: { subscription: f.sub, metadata: { ...f.metadata } } },
      lines: { object: "list", data: f.linhas.map((l, i) => ({ id: `il_${f.id}_${i}`, amount: l.amount, period: { start: l.start, end: l.end } })) },
    };
  }
  function agendaObj(aid: string) {
    const a = s.agendas.get(aid)!;
    const atual = a.phases[a.atual];
    return {
      id: a.id, object: "subscription_schedule", status: a.status, subscription: a.sub, end_behavior: "release",
      current_phase: a.status === "active" && atual ? { start_date: atual.start_date, end_date: atual.end_date } : null,
      phases: structuredClone(a.phases),
    };
  }
  function retrato(sid: string, expand: string[] = []) {
    const a = s.assinaturas.get(sid)!;
    return {
      id: a.id, object: "subscription", customer: a.customer, status: a.status, metadata: { ...a.metadata },
      items: { object: "list", data: [{ id: a.itemId, price: precoObj(a.preco), quantity: 1, current_period_start: a.inicio, current_period_end: a.fim }] },
      pending_update: a.pending
        ? { expires_at: a.pending.expires_at, subscription_items: [{ id: a.itemId, price: precoObj(a.pending.preco) }], metadata: { ...a.pending.metadata } }
        : null,
      schedule: a.schedule && expand.includes("schedule") ? agendaObj(a.schedule) : a.schedule,
      latest_invoice: a.latest_invoice && expand.includes("latest_invoice") ? faturaObj(a.latest_invoice) : a.latest_invoice,
      cancel_at_period_end: a.cancel_at_period_end, cancel_at: null,
    };
  }

  // ── regras ──
  function precoInline(plano: PlanDef) {
    const p: Preco = { id: id("price"), unit_amount: plano.priceInCents, interval: plano.interval, product: id("prod"), lookup_key: null };
    s.precos.set(p.id, p);
    return p.id;
  }
  function novaFatura(sub: string, motivo: string, linhas: Linha[], metadata: Record<string, string>, paga: boolean): string {
    const f: Fatura = { id: id("in"), sub, status: paga ? "paid" : "open", billing_reason: motivo, amount: linhas.reduce((t, l) => t + l.amount, 0), linhas, metadata: { ...metadata } };
    s.faturas.set(f.id, f);
    if (paga) s.cobrancas.push({ fatura: f.id, sub, valor: f.amount, motivo });
    return f.id;
  }
  const cobravel = (sid: string) => (s.cartoes.get(sid) ?? "ok") === "ok";

  /** Assinatura nova paga (o que o Checkout cria), com a primeira fatura. */
  function criarAssinatura(opcoes: { metadata: Record<string, string>; plano: PlanDef; customer?: string }): string {
    const preco = precoInline(opcoes.plano);
    const a: Assinatura = {
      id: id("sub"), customer: opcoes.customer ?? id("cus"), status: "active", metadata: { ...opcoes.metadata },
      itemId: id("si"), preco, inicio: s.agora, fim: s.agora + duracao(opcoes.plano.interval),
      pending: null, schedule: null, latest_invoice: null, cancel_at_period_end: false,
    };
    s.assinaturas.set(a.id, a);
    a.latest_invoice = novaFatura(a.id, "subscription_create", [{ start: a.inicio, end: a.fim, amount: opcoes.plano.priceInCents }], a.metadata, true);
    return a.id;
  }

  function aplicarPendente(a: Assinatura) {
    const p = a.pending!;
    const novo = s.precos.get(p.preco)!;
    const antigo = s.precos.get(a.preco)!;
    if (novo.interval !== antigo.interval) { a.inicio = s.agora; a.fim = s.agora + duracao(novo.interval); }
    a.preco = p.preco;
    Object.assign(a.metadata, p.metadata);
    a.pending = null;
  }

  function trocarPreco(a: Assinatura, params: Record<string, any>) {
    const novo = s.precos.get(params.items[0].price);
    if (!novo) throw erro("StripeInvalidRequestError", 400, "resource_missing", "No such price");
    if (a.schedule && s.agendas.get(a.schedule)?.status === "active") {
      throw erro("StripeInvalidRequestError", 400, "subscription_schedule_active", "managed by a subscription schedule");
    }
    if (params.payment_behavior !== "pending_if_incomplete" || params.proration_behavior !== "always_invoice") {
      throw erro("StripeInvalidRequestError", 400, "parametros_inesperados", "teste espera pending_if_incomplete + always_invoice");
    }
    if (a.pending) s.faturas.get(a.pending.fatura)!.status = "void"; // a nova troca substitui a pendente
    const antigo = s.precos.get(a.preco)!;
    const resto = (a.fim - s.agora) / (a.fim - a.inicio);
    const credito = -Math.round(antigo.unit_amount * resto);
    const fimNovo = novo.interval === antigo.interval ? a.fim : s.agora + duracao(novo.interval);
    const debito = novo.interval === antigo.interval ? Math.round(novo.unit_amount * resto) : novo.unit_amount;
    const linhas = [{ start: s.agora, end: a.fim, amount: credito }, { start: s.agora, end: fimNovo, amount: debito }];
    const paga = cobravel(a.id);
    const fatura = novaFatura(a.id, "subscription_update", linhas, a.metadata, paga);
    a.latest_invoice = fatura;
    a.pending = { preco: novo.id, metadata: { ...(params.metadata ?? {}) }, fatura, expires_at: s.agora + 23 * 3600 };
    if (paga) aplicarPendente(a);
  }

  function assinatura(sid: string): Assinatura {
    let a = s.assinaturas.get(sid);
    const externa = !a && s.externas ? s.externas(sid) : null;
    if (!a && externa) {
      s.assinaturas.set(sid, {
        id: sid, customer: id("cus"), status: "active", metadata: { userId: externa.userId },
        itemId: id("si"), preco: precoInline(PLANS.pro_mensal), inicio: s.agora, fim: s.agora + 30 * DIA,
        pending: null, schedule: null, latest_invoice: null, cancel_at_period_end: false,
      });
      a = s.assinaturas.get(sid)!;
      a.latest_invoice = novaFatura(sid, "subscription_create", [{ start: a.inicio, end: a.fim, amount: 3990 }], a.metadata, externa.paga);
    }
    if (!a) throw erro("StripeInvalidRequestError", 404, "resource_missing", `No such subscription: '${sid}'`);
    return a;
  }

  // ── métodos instalados no client ──
  const metodos = {
    "subscriptions.retrieve": async (sid: string, p?: { expand?: string[] }) => retrato(assinatura(sid).id, p?.expand ?? []),
    "subscriptions.update": (sid: string, params: Record<string, any>, o?: { idempotencyKey?: string }) =>
      idempotente("subscriptions.update", { sid, ...params }, o, () => {
        const a = assinatura(sid);
        if (params.items) trocarPreco(a, params);
        else if (params.metadata) Object.assign(a.metadata, params.metadata);
        if (params.cancel_at_period_end !== undefined) a.cancel_at_period_end = params.cancel_at_period_end;
        return retrato(a.id, params.expand ?? []);
      }),
    "subscriptionSchedules.create": (params: { from_subscription: string }, o?: { idempotencyKey?: string }) =>
      idempotente("subscriptionSchedules.create", params, o, () => {
        const a = assinatura(params.from_subscription);
        if (a.schedule && s.agendas.get(a.schedule)?.status === "active") {
          throw erro("StripeInvalidRequestError", 400, "resource_already_exists", "subscription already has a schedule");
        }
        const ag: Agenda = { id: id("sub_sched"), sub: a.id, status: "active", atual: 0,
          phases: [{ start_date: a.inicio, end_date: a.fim, items: [{ price: a.preco, quantity: 1 }], metadata: {} }] };
        s.agendas.set(ag.id, ag);
        a.schedule = ag.id;
        return agendaObj(ag.id);
      }),
    "subscriptionSchedules.retrieve": async (aid: string) => agendaObj(aid),
    "subscriptionSchedules.update": (aid: string, params: Record<string, any>, o?: { idempotencyKey?: string }) =>
      idempotente("subscriptionSchedules.update", { aid, ...params }, o, () => {
        const ag = s.agendas.get(aid)!;
        const atual = ag.phases[ag.atual];
        const [primeira, segunda] = params.phases;
        if (primeira.start_date !== atual.start_date || primeira.end_date !== atual.end_date) {
          throw erro("StripeInvalidRequestError", 400, "fase_atual_alterada", "a fase atual deve ser preservada");
        }
        ag.phases = [
          ...ag.phases.slice(0, ag.atual),
          { ...atual, items: primeira.items, metadata: primeira.metadata ?? {} },
          { start_date: atual.end_date, end_date: atual.end_date + duracao(segunda.duration.interval), items: segunda.items, metadata: segunda.metadata ?? {} },
        ];
        return agendaObj(aid);
      }),
    "subscriptionSchedules.release": (aid: string, params: unknown, o?: { idempotencyKey?: string }) =>
      idempotente("subscriptionSchedules.release", { aid }, o, () => {
        const ag = s.agendas.get(aid)!;
        if (ag.status !== "active") throw erro("StripeInvalidRequestError", 400, "schedule_not_active", "not active");
        ag.status = "released";
        s.assinaturas.get(ag.sub)!.schedule = null;
        return agendaObj(aid);
      }),
    "invoices.retrieve": async (fid: string) => faturaObj(fid),
    "invoices.voidInvoice": (fid: string, params: unknown, o?: { idempotencyKey?: string }) =>
      idempotente("invoices.voidInvoice", { fid }, o, () => {
        const f = s.faturas.get(fid)!;
        if (f.status !== "open") throw erro("StripeInvalidRequestError", 400, "invoice_not_open", "not open");
        f.status = "void";
        const a = s.assinaturas.get(f.sub)!;
        if (a.pending?.fatura === fid) a.pending = null;
        return faturaObj(fid);
      }),
    "prices.list": async (p: { lookup_keys: string[] }) => ({
      object: "list", data: [...s.precos.values()].filter((x) => x.lookup_key && p.lookup_keys.includes(x.lookup_key)).map((x) => precoObj(x.id)),
    }),
    "prices.create": (p: Record<string, any>, o?: { idempotencyKey?: string }) =>
      idempotente("prices.create", p, o, () => {
        if ([...s.precos.values()].some((x) => x.lookup_key === p.lookup_key)) {
          throw erro("StripeInvalidRequestError", 400, "lookup_key_exists", "lookup_key already exists");
        }
        const preco: Preco = { id: id("price"), unit_amount: p.unit_amount, interval: p.recurring.interval, product: p.product, lookup_key: p.lookup_key };
        s.precos.set(preco.id, preco);
        return precoObj(preco.id);
      }),
    "products.create": (p: { id: string }, o?: { idempotencyKey?: string }) =>
      idempotente("products.create", p, o, () => {
        if (s.produtos.has(p.id)) throw erro("StripeInvalidRequestError", 400, "resource_already_exists", "exists");
        s.produtos.add(p.id);
        return { id: p.id, object: "product" };
      }),
    "checkout.sessions.create": (params: Record<string, any>, o?: { idempotencyKey?: string }) =>
      idempotente("checkout.sessions.create", params, o, () => {
        const ses: Sessao = { id: id("cs_test"), status: "open", params, sub: null };
        s.sessoes.set(ses.id, ses);
        return sessaoObj(ses.id);
      }),
    "checkout.sessions.retrieve": async (cid: string) => sessaoObj(cid),
    "checkout.sessions.expire": (cid: string, params: unknown, o?: { idempotencyKey?: string }) =>
      idempotente("checkout.sessions.expire", { cid }, o, () => {
        const ses = s.sessoes.get(cid)!;
        if (ses.status !== "open") throw erro("StripeInvalidRequestError", 400, "checkout_session_not_open", "not open");
        ses.status = "expired";
        return sessaoObj(cid);
      }),
  };
  function sessaoObj(cid: string) {
    const ses = s.sessoes.get(cid)!;
    return {
      id: ses.id, object: "checkout.session", status: ses.status, mode: "subscription",
      payment_status: ses.status === "complete" ? "paid" : "unpaid", url: `https://checkout.stripe.test/${ses.id}`,
      client_reference_id: ses.params.client_reference_id, metadata: { ...ses.params.metadata }, subscription: ses.sub,
    };
  }

  const originais: Array<[Record<string, unknown>, string, unknown]> = [];
  return {
    estado: s,
    retrato,
    faturaObj,
    sessaoObj,
    criarAssinatura,
    /** Instala os métodos no client (`stripe` de lib/stripe). */
    instalar(stripe: unknown) {
      for (const [caminho, fn] of Object.entries(metodos)) {
        const partes = caminho.split(".");
        let alvo = stripe as Record<string, unknown>;
        for (const p of partes.slice(0, -1)) alvo = alvo[p] as Record<string, unknown>;
        const nome = partes[partes.length - 1];
        originais.push([alvo, nome, alvo[nome]]);
        alvo[nome] = fn;
      }
    },
    restaurar() {
      for (const [alvo, nome, original] of originais.reverse()) alvo[nome] = original;
      originais.length = 0;
    },
    cartao(sid: string, modo: Cartao) {
      s.cartoes.set(sid, modo);
    },
    /** O cliente paga a sessão aberta: cria a assinatura e a primeira fatura paga. */
    completarCheckout(cid: string): string {
      const ses = s.sessoes.get(cid)!;
      if (ses.status !== "open") throw new Error(`sessão ${cid} não está aberta (${ses.status})`);
      const meta = ses.params.subscription_data?.metadata ?? {};
      ses.sub = criarAssinatura({ metadata: meta, plano: PLANS[meta.planId as keyof typeof PLANS] });
      ses.status = "complete";
      return ses.sub;
    },
    /** O cliente paga a fatura hospedada (troca pendente). */
    pagarFatura(fid: string) {
      const f = s.faturas.get(fid)!;
      if (f.status !== "open") throw new Error(`fatura ${fid} não está aberta (${f.status})`);
      f.status = "paid";
      s.cobrancas.push({ fatura: f.id, sub: f.sub, valor: f.amount, motivo: f.billing_reason });
      const a = s.assinaturas.get(f.sub)!;
      if (a.pending?.fatura === fid) aplicarPendente(a);
    },
    /** 23 h sem pagamento: a Stripe anula a fatura e descarta a troca. */
    expirarPendencia(sid: string) {
      const a = s.assinaturas.get(sid)!;
      if (!a.pending) throw new Error(`assinatura ${sid} sem troca pendente`);
      s.faturas.get(a.pending.fatura)!.status = "void";
      a.pending = null;
    },
    /** Fim do período: renova no preço vigente — ou entra na próxima fase da agenda. */
    renovar(sid: string): string {
      const a = s.assinaturas.get(sid)!;
      s.agora = a.fim;
      const ag = a.schedule ? s.agendas.get(a.schedule) : null;
      const proxima = ag && ag.status === "active" ? ag.phases[ag.atual + 1] : null;
      if (proxima && proxima.start_date === a.fim) {
        ag!.atual += 1;
        a.preco = proxima.items[0].price;
        Object.assign(a.metadata, proxima.metadata);
      }
      const preco = s.precos.get(a.preco)!;
      a.inicio = a.fim;
      a.fim = a.inicio + duracao(preco.interval);
      a.latest_invoice = novaFatura(a.id, "subscription_cycle", [{ start: a.inicio, end: a.fim, amount: preco.unit_amount }], a.metadata, cobravel(a.id));
      return a.latest_invoice;
    },
    /** Assinaturas que ainda vão cobrar na próxima renovação. */
    cobrandoNaRenovacao(): string[] {
      return [...s.assinaturas.values()].filter((a) => a.status === "active" && !a.cancel_at_period_end).map((a) => a.id);
    },
  };
}

export type StripeFalso = ReturnType<typeof criarStripeFalso>;
