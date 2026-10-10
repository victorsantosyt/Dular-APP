import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";

// Faturas (invoice.paid / invoice.payment_failed) com a assinatura em cada
// formato que a Stripe já usou, e o caminho de cada evento de assinatura até o
// banco. Assinatura HMAC REAL, gerada pelo próprio SDK com segredo fictício —
// nada de constructEvent mockado. Banco simulado em memória: confere QUAL
// assinatura foi travada e guardada e o efeito gravado, não só o 200. O lock
// consultivo por `sub_` é emulado com uma fila por chave. A semântica da ordem
// fica com o teste puro (stripe-assinatura-dobra.test.ts) e o de Postgres real
// (stripe-assinatura-ordem-db.test.ts).

const SEGREDO = "whsec_ficticio_issue_342_somente_teste";
const ORIGINAL_ENV = { ...process.env };
const FIM_DO_PERIODO = 1_893_456_000; // 2030-01-01T00:00:00Z
const CRIADO = 1_790_000_000; // `created` padrão dos eventos
const DIA = 86_400;

type Linha = {
  id: string;
  userId: string;
  plan: string;
  provider: string;
  externalId: string | null;
  storeProductId: string | null;
  status: string;
  startedAt: Date;
  canceledAt: Date | null;
  expiresAt: Date | null;
  stripeBase: unknown;
  updatedAt: Date;
};
type EventoGuardado = {
  eventId: string;
  externalId: string;
  tipo: string;
  criadoEm: Date;
  fimPeriodo: Date | null;
  faturaId: string | null;
};

let banco: Linha[] = [];
let eventos: EventoGuardado[] = [];
/** StripeOperacao gravadas (a troca de vínculo grava o cancelamento da `sub_` anterior). */
let operacoes: Array<Record<string, unknown>> = [];
/** `externalId` de cada lock consultivo pedido, na ordem. */
let travas: string[] = [];
/** Comandos de `$executeRaw` na ordem: "limites" (SET LOCAL) ou "lock". */
let brutos: string[] = [];
let chamadas: string[] = [];
let usuarios = new Set<string>();
let relogio = 0;
const erros: unknown[][] = [];
const errorOriginal = console.error;

// updatedAt artificial e sempre crescente: qualquer escrita muda a foto.
const tique = () => new Date(Date.UTC(2026, 0, 1) + ++relogio);

function linha(externalId: string, userId: string, estado: Partial<Linha>): Linha {
  return {
    id: `row-${externalId}`,
    userId,
    plan: "PREMIUM",
    provider: "STRIPE",
    externalId,
    storeProductId: null,
    status: "ACTIVE",
    startedAt: new Date("2026-09-01T00:00:00Z"),
    canceledAt: null,
    expiresAt: new Date("2026-10-15T00:00:00Z"),
    stripeBase: null,
    updatedAt: tique(),
    ...estado,
  };
}

const ms = (v: unknown) => (v instanceof Date ? v.getTime() : v);

// Só o que o código usa: igualdade, AND/OR e `not`/`lte` deixando NULL de fora.
function campoCasa(atual: unknown, filtro: unknown): boolean {
  if (filtro === null) return atual === null;
  if (filtro instanceof Date || typeof filtro !== "object") return ms(atual) === ms(filtro);
  return Object.entries(filtro as Record<string, unknown>).every(([op, v]) => {
    if (atual === null || atual === undefined) return false;
    const a = ms(atual) as number;
    const b = ms(v) as number;
    if (op === "not") return a !== b;
    if (op === "lte") return a <= b;
    throw new Error(`operador não simulado: ${op}`);
  });
}

function casa(where: Record<string, unknown>, l: Record<string, unknown>): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (v === undefined) return true;
    if (k === "AND") return (v as Record<string, unknown>[]).every((w) => casa(w, l));
    if (k === "OR") return (v as Record<string, unknown>[]).some((w) => casa(w, l));
    return campoCasa(l[k], v);
  });
}

/** Índices únicos: userId; (provider, externalId) quando externalId não é nulo. */
function colide(l: Linha, ignorar?: Linha) {
  return banco.some(
    (o) =>
      o !== ignorar &&
      (o.userId === l.userId || (l.externalId !== null && o.provider === l.provider && o.externalId === l.externalId)),
  );
}

function instalarBanco(estadoAlvo: Partial<Linha> | null, opcoes: { semUsuario?: boolean } = {}) {
  banco = [linha("sub_outra_342", "u-outra", { status: "ACTIVE", expiresAt: new Date("2026-11-20T00:00:00Z") })];
  if (estadoAlvo) banco.unshift(linha("sub_alvo_342", "u-alvo", estadoAlvo));
  eventos = [];
  operacoes = [];
  travas = [];
  brutos = [];
  chamadas = [];
  usuarios = new Set(opcoes.semUsuario ? ["u-outra"] : ["u-alvo", "u-outra"]);

  const subscription = {
    findFirst: async (args: { where: Record<string, unknown> }) => {
      chamadas.push("subscription.findFirst");
      const achada = banco.find((l) => casa(args.where, l));
      return achada ? structuredClone(achada) : null;
    },
    updateMany: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      chamadas.push("subscription.updateMany");
      let count = 0;
      for (const l of banco) {
        if (!casa(args.where, l)) continue;
        const nova = { ...l };
        for (const [k, v] of Object.entries(args.data)) {
          if (v !== undefined) (nova as Record<string, unknown>)[k] = v;
        }
        if (colide(nova, l)) throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        Object.assign(l, nova, { updatedAt: tique() });
        count += 1;
      }
      return { count };
    },
    createMany: async (args: { data: Array<Omit<Linha, "id" | "updatedAt">>; skipDuplicates?: boolean }) => {
      chamadas.push("subscription.createMany");
      let count = 0;
      for (const d of args.data) {
        const nova: Linha = { id: `row-nova-${d.userId}`, ...d, updatedAt: tique() };
        if (colide(nova)) {
          if (args.skipDuplicates) continue;
          throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        }
        banco.push(nova);
        count += 1;
      }
      return { count };
    },
    upsert: async () => {
      throw new Error("o Stripe não usa upsert (reescreveria a linha a cada entrega)");
    },
  };
  const stripeEventoAssinatura = {
    createMany: async (args: { data: EventoGuardado[]; skipDuplicates?: boolean }) => {
      chamadas.push("evento.createMany");
      let count = 0;
      for (const e of args.data) {
        if (eventos.some((x) => x.eventId === e.eventId)) {
          if (args.skipDuplicates) continue;
          throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        }
        eventos.push(structuredClone(e));
        count += 1;
      }
      return { count };
    },
    findMany: async (args: { where: { externalId: string } }) => {
      chamadas.push("evento.findMany");
      return structuredClone(eventos.filter((e) => e.externalId === args.where.externalId));
    },
  };
  const user = {
    findUnique: async (args: { where: { id: string } }) => {
      chamadas.push("user.findUnique");
      return usuarios.has(args.where.id) ? { id: args.where.id } : null;
    },
  };

  // Gravadas para conferência; nenhuma é retomada aqui (a retomada chama a Stripe).
  const stripeOperacao = {
    create: async (args: { data: Record<string, unknown> }) => {
      chamadas.push("operacao.create");
      operacoes.push(structuredClone(args.data));
      return args.data;
    },
    findMany: async () => [],
    updateMany: async () => ({ count: 0 }),
    // Prova de origem (lib/origemDoCheckout): a operação `checkout` que a rota
    // gravou, `prova-<usuário>-<plano>:<sub_>`, já ligada à `sub_` daquela
    // compra (como fica depois do checkout). Fora da contagem de `chamadas`.
    findUnique: async (args: { where: { chave?: string } }) => {
      const m = /^prova-(.+)-(\w+):(sub_\w+)$/.exec(args.where.chave ?? "");
      return m ? { tipo: "checkout", userId: m[1], planId: m[2], referencia: null, externalId: m[3] } : null;
    },
    // Nenhuma assinatura destes testes foi substituída por troca de vínculo.
    findFirst: async () => null,
  };

  // Lock consultivo emulado: uma fila por chave, solta no fim da transação.
  const filas = new Map<string, Promise<void>>();
  const raiz = mockPrisma as unknown as Record<string, unknown>;
  raiz.subscription = subscription;
  raiz.stripeEventoAssinatura = stripeEventoAssinatura;
  raiz.stripeOperacao = stripeOperacao;
  raiz.user = user;
  raiz.$transaction = async (fn: (tx: unknown) => Promise<unknown>) => {
    chamadas.push("$transaction");
    const soltar: Array<() => void> = [];
    const tx = {
      subscription,
      stripeEventoAssinatura,
      stripeOperacao,
      user,
      // Nenhuma compra de loja nestes testes (issue #359).
      assinaturaLoja: { count: async () => 0 },
      $executeRaw: async (sql: TemplateStringsArray, ...valores: unknown[]) => {
        if (!sql.join("?").includes("pg_advisory_xact_lock")) {
          brutos.push(sql.join("?").includes("set_config('lock_timeout'") ? "limites" : "outro");
          return 1;
        }
        brutos.push("lock");
        const chave = String(valores[0]);
        travas.push(chave);
        const anterior = filas.get(chave) ?? Promise.resolve();
        let liberar!: () => void;
        const minha = new Promise<void>((r) => (liberar = r));
        filas.set(chave, anterior.then(() => minha));
        await anterior;
        soltar.push(liberar);
        return 1;
      },
    };
    try {
      return await fn(tx);
    } finally {
      for (const f of soltar) f();
    }
  };
}

const copia = (externalId: string) => structuredClone(banco.find((l) => l.externalId === externalId)!);
const doUsuario = (userId: string) => structuredClone(banco.find((l) => l.userId === userId) ?? null);
const iso = (s: number) => new Date(s * 1000).toISOString();

type OpcoesEvento = { id?: string; criado?: number | null; adulterar?: (corpo: string) => string };

async function enviarEvento(tipo: string, objeto: Record<string, unknown>, opcoes: OpcoesEvento = {}) {
  const { stripe } = await import("../../src/lib/stripe");
  const payload = JSON.stringify({
    id: opcoes.id ?? `evt_test_342_${Math.random().toString(36).slice(2)}`,
    object: "event",
    type: tipo,
    api_version: "2025-03-31.basil",
    created: opcoes.criado === undefined ? CRIADO : opcoes.criado,
    livemode: false,
    data: { object: objeto },
  });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: SEGREDO });
  const corpo = opcoes.adulterar ? opcoes.adulterar(payload) : payload;
  const mod = await import("../../src/app/api/webhooks/stripe/route");
  return mod.POST(
    new Request("http://test/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": header },
      body: corpo,
    }),
  );
}

const enviar = (tipo: string, fatura: Record<string, unknown>, opcoes: OpcoesEvento = {}) =>
  enviarEvento(tipo, { id: "in_test_342", object: "invoice", metadata: {}, ...fatura }, opcoes);

// ── Formatos de fatura ──────────────────────────────────────────────────────
const periodo = { start: FIM_DO_PERIODO - 30 * 86400, end: FIM_DO_PERIODO };
const linhaSemAssinatura = { id: "il_test_342", object: "line_item", period: periodo, subscription: null };
const linhas = (extra: Record<string, unknown> = {}) => ({
  object: "list",
  data: [{ ...linhaSemAssinatura, ...extra }],
});
const parentAssinatura = (subscription: unknown, metadata: Record<string, string> = {}) => ({
  type: "subscription_details",
  quote_details: null,
  subscription_details: { metadata, subscription },
});

const ALVO = "sub_alvo_342";
const expandida = (id: unknown) => ({ id, object: "subscription" });

const reconhecidos: Array<[string, Record<string, unknown>]> = [
  ["parent com assinatura em string", { parent: parentAssinatura(ALVO), lines: linhas() }],
  ["parent com assinatura expandida", { parent: parentAssinatura(expandida(ALVO)), lines: linhas() }],
  ["legado invoice.subscription (string)", { subscription: ALVO, lines: linhas() }],
  ["legado invoice.subscription (expandida)", { subscription: expandida(ALVO), lines: linhas() }],
  ["legado na linha da fatura (string)", { lines: linhas({ subscription: ALVO }) }],
  ["legado na linha da fatura (expandida)", { lines: linhas({ subscription: expandida(ALVO) }) }],
  ["parent e legado com o MESMO id", { parent: parentAssinatura(ALVO), subscription: ALVO, lines: linhas({ subscription: ALVO }) }],
  ["parent de outro tipo, com legado", {
    parent: { type: "quote_details", quote_details: { quote: "qt_test_342" }, subscription_details: null },
    subscription: ALVO,
    lines: linhas(),
  }],
];

const ignorados: Array<[string, Record<string, unknown>]> = [
  ["parent ausente, sem legado", { lines: linhas() }],
  ["parent nulo, sem legado", { parent: null, lines: linhas() }],
  ["parent de outro tipo (quote_details)", {
    parent: { type: "quote_details", quote_details: { quote: "qt_test_342" }, subscription_details: null },
    lines: linhas(),
  }],
  ["parent de outro tipo trazendo subscription_details", {
    parent: { type: "quote_details", quote_details: { quote: "qt_test_342" }, subscription_details: { metadata: {}, subscription: ALVO } },
    lines: linhas(),
  }],
  ["parent sem subscription_details", { parent: { type: "subscription_details", subscription_details: null }, lines: linhas() }],
  ["assinatura vazia", { parent: parentAssinatura(""), lines: linhas() }],
  ["expandida sem id", { parent: parentAssinatura({ object: "subscription" }), lines: linhas() }],
  ["expandida com id não-string", { parent: parentAssinatura(expandida(123)), lines: linhas() }],
  ["id que não é de assinatura", { parent: parentAssinatura("in_test_342"), lines: linhas() }],
  ["sem nenhuma lista de linhas", {}],
  ["parent e legado com ids DIFERENTES", { parent: parentAssinatura(ALVO), subscription: "sub_outra_342", lines: linhas() }],
  ["parent e linha com ids DIFERENTES", { parent: parentAssinatura(ALVO), lines: linhas({ subscription: "sub_outra_342" }) }],
];

function silenciarErros() {
  beforeEach(() => {
    resetMockPrisma();
    process.env.STRIPE_WEBHOOK_SECRET = SEGREDO;
    delete process.env.STRIPE_WEBHOOK_ALLOW_UNSIGNED_DEV;
    erros.length = 0;
    console.error = (...a: unknown[]) => {
      erros.push(a);
    };
  });
  after(() => {
    console.error = errorOriginal;
    process.env.STRIPE_WEBHOOK_SECRET = ORIGINAL_ENV.STRIPE_WEBHOOK_SECRET;
  });
}

describe("POST /api/webhooks/stripe — faturas (HMAC real, banco simulado)", () => {
  silenciarErros();

  describe("invoice.paid", () => {
    const expirada = { status: "EXPIRED", canceledAt: new Date("2026-09-01T00:00:00Z"), expiresAt: new Date("2026-09-01T00:00:00Z") };

    for (const [nome, fatura] of reconhecidos) {
      it(`renova a assinatura certa: ${nome}`, async () => {
        instalarBanco(expirada);
        const outraAntes = copia("sub_outra_342");
        const res = await enviar("invoice.paid", fatura, { id: "evt_test_342_pago" });
        assert.equal(res.status, 200);
        assert.deepEqual(travas, [ALVO], "o lock é o da assinatura da fatura");
        assert.deepEqual(eventos, [
          {
            eventId: "evt_test_342_pago",
            externalId: ALVO,
            tipo: "invoice.paid",
            criadoEm: new Date(CRIADO * 1000),
            fimPeriodo: new Date(FIM_DO_PERIODO * 1000),
            faturaId: "in_test_342",
          },
        ]);
        assert.deepEqual(brutos, ["limites", "lock"], "limites de tempo ANTES do lock");
        const alvo = copia(ALVO);
        assert.equal(alvo.status, "ACTIVE");
        assert.equal(alvo.canceledAt, null);
        assert.deepEqual(alvo.expiresAt, new Date(FIM_DO_PERIODO * 1000));
        // Linha anterior à mudança: a base é o estado que ela tinha, marcada como
        // legado até o expiresAt dela (o período desta fatura vem depois: aplica).
        assert.deepEqual(alvo.stripeBase, {
          status: "EXPIRED",
          expiresAt: "2026-09-01T00:00:00.000Z",
          canceledAt: "2026-09-01T00:00:00.000Z",
          origem: "legado",
          periodoReconhecido: "2026-09-01T00:00:00.000Z",
        });
        assert.deepEqual(copia("sub_outra_342"), outraAntes);
      });
    }

    for (const [nome, fatura] of ignorados) {
      it(`não altera nenhuma assinatura: ${nome}`, async () => {
        instalarBanco(expirada);
        const antes = structuredClone(banco);
        const res = await enviar("invoice.paid", fatura);
        assert.equal(res.status, 200);
        assert.deepEqual(banco, antes);
        assert.deepEqual(chamadas, [], "nenhuma consulta nem escrita no banco");
        assert.deepEqual(eventos, []);
      });
    }

    it("assinatura que não está no banco, sem metadados: só o evento fica guardado", async () => {
      instalarBanco(expirada);
      const antes = structuredClone(banco);
      const res = await enviar("invoice.paid", { parent: parentAssinatura("sub_inexistente_342"), lines: linhas() });
      assert.equal(res.status, 200);
      assert.deepEqual(banco, antes);
      assert.deepEqual(travas, ["sub_inexistente_342"]);
      assert.deepEqual(
        eventos.map((e) => e.externalId),
        ["sub_inexistente_342"],
        "guardado para o completed aplicar quando criar o vínculo",
      );
    });

    it("ids divergentes ficam registrados no log", async () => {
      instalarBanco(expirada);
      await enviar("invoice.paid", { parent: parentAssinatura(ALVO), subscription: "sub_outra_342", lines: linhas() });
      assert.ok(erros.some((e) => String(e[0]).includes("assinaturas divergentes")));
    });
  });

  describe("invoice.payment_failed", () => {
    const ativa = { status: "ACTIVE", canceledAt: null, expiresAt: new Date("2026-12-31T00:00:00Z") };

    for (const [nome, fatura] of reconhecidos) {
      it(`encerra a assinatura certa: ${nome}`, async () => {
        instalarBanco(ativa);
        const outraAntes = copia("sub_outra_342");
        const res = await enviar("invoice.payment_failed", fatura, { id: "evt_test_342_falha" });
        assert.equal(res.status, 200);
        assert.deepEqual(travas, [ALVO]);
        assert.deepEqual(eventos, [
          {
            eventId: "evt_test_342_falha",
            externalId: ALVO,
            tipo: "invoice.payment_failed",
            criadoEm: new Date(CRIADO * 1000),
            // O período da fatura que falhou entra na ordem (v3).
            fimPeriodo: new Date(FIM_DO_PERIODO * 1000),
            faturaId: "in_test_342",
          },
        ]);
        const alvo = copia(ALVO);
        const quando = new Date(CRIADO * 1000);
        assert.equal(alvo.status, "EXPIRED");
        // Corte na hora do EVENTO, não na do servidor: reentrega não o empurra.
        assert.deepEqual(alvo.canceledAt, quando);
        assert.deepEqual(alvo.expiresAt, quando);
        assert.deepEqual(copia("sub_outra_342"), outraAntes);
      });
    }

    for (const [nome, fatura] of ignorados) {
      it(`não altera nenhuma assinatura: ${nome}`, async () => {
        instalarBanco(ativa);
        const antes = structuredClone(banco);
        const res = await enviar("invoice.payment_failed", fatura);
        assert.equal(res.status, 200);
        assert.deepEqual(banco, antes);
        assert.deepEqual(chamadas, [], "nenhuma consulta nem escrita no banco");
        assert.deepEqual(eventos, []);
      });
    }
  });

  describe("assinatura HMAC", () => {
    it("payload adulterado depois de assinado: 400 e banco intacto", async () => {
      instalarBanco({ status: "ACTIVE", canceledAt: null, expiresAt: new Date("2026-12-31T00:00:00Z") });
      const antes = structuredClone(banco);
      const res = await enviar(
        "invoice.payment_failed",
        { parent: parentAssinatura("sub_outra_342"), lines: linhas() },
        { adulterar: (corpo) => corpo.replace("sub_outra_342", ALVO) },
      );
      assert.equal(res.status, 400);
      assert.deepEqual(await res.json(), { error: "Invalid signature" });
      assert.deepEqual(banco, antes);
      assert.deepEqual(chamadas, []);
    });

    it("assinado com outro segredo: 400 e banco intacto", async () => {
      instalarBanco({ status: "ACTIVE", canceledAt: null, expiresAt: new Date("2026-12-31T00:00:00Z") });
      const antes = structuredClone(banco);
      process.env.STRIPE_WEBHOOK_SECRET = "whsec_outro_segredo_ficticio_342";
      const res = await enviar("invoice.payment_failed", { parent: parentAssinatura(ALVO), lines: linhas() });
      assert.equal(res.status, 400);
      assert.deepEqual(banco, antes);
      assert.deepEqual(chamadas, []);
    });
  });
});

describe("POST /api/webhooks/stripe — eventos de assinatura até o banco (HMAC real, banco simulado)", () => {
  silenciarErros();

  const quando = (s: number) => new Date(s * 1000);
  const fim = (dias: number) => CRIADO + dias * DIA;
  const META = { userId: "u-alvo", planId: "pro_anual", subscriptionPlan: "PREMIUM", operacao: "prova-u-alvo-pro_anual" };
  let outraInicial: Linha;
  let validadeAnual: (s: number) => string;

  // A operação da compra é a desta `sub_` (ver o mock de stripeOperacao.findUnique).
  const daCompra = (metadata: Record<string, string>, sub: string) =>
    metadata.operacao ? { ...metadata, operacao: `${metadata.operacao}:${sub}` } : metadata;
  const fatura = (sub: string, fimSeg: number, metadata: Record<string, string> = {}, faturaId = "in_test_342", motivo?: string) => ({
    id: faturaId,
    billing_reason: motivo,
    parent: parentAssinatura(sub, daCompra(metadata, sub)),
    lines: { object: "list", data: [{ ...linhaSemAssinatura, period: { start: fimSeg - 30 * DIA, end: fimSeg } }] },
  });
  const sessao = (sub: unknown, userId = "u-alvo") => ({
    id: "cs_test_342",
    object: "checkout.session",
    mode: "subscription",
    payment_status: "paid",
    client_reference_id: userId,
    subscription: sub,
    metadata: { userId, planId: "pro_anual", subscriptionPlan: "PREMIUM", operacao: `prova-${userId}-pro_anual:${typeof sub === "string" ? sub : (sub as { id: string }).id}` },
  });
  // Cada evento de fatura leva a SUA fatura (`in_<evento>` por padrão) e o período dela.
  // Renovação por padrão: só a primeira fatura (`subscription_create`) cria vínculo.
  const pago = (
    id: string,
    criado: number,
    fimSeg: number,
    metadata: Record<string, string> = META,
    sub = ALVO,
    faturaId = `in_${id}`,
    motivo = "subscription_cycle",
  ) => enviar("invoice.paid", fatura(sub, fimSeg, metadata, faturaId, motivo), { id, criado });
  const primeira = (id: string, criado: number, fimSeg: number, metadata: Record<string, string> = META, sub = ALVO) =>
    pago(id, criado, fimSeg, metadata, sub, `in_${id}`, "subscription_create");
  const falhou = (id: string, criado: number, fimSeg: number, sub = ALVO, faturaId = `in_${id}`) =>
    enviar("invoice.payment_failed", fatura(sub, fimSeg, {}, faturaId), { id, criado });
  const concluido = (id: string, criado: number, sub = ALVO) =>
    enviarEvento("checkout.session.completed", sessao(sub), { id, criado });
  const cancelado = (id: string, criado: number, sub = ALVO) =>
    enviarEvento("customer.subscription.deleted", { id: sub, object: "subscription", status: "canceled" }, { id, criado });

  function instalar(estadoAlvo: Partial<Linha> | null, opcoes: { semUsuario?: boolean } = {}) {
    instalarBanco(estadoAlvo, opcoes);
    outraInicial = copia("sub_outra_342");
  }
  const outraIntacta = () => assert.deepEqual(copia("sub_outra_342"), outraInicial);

  beforeEach(async () => {
    const { PLANS, validadeDoPlano } = await import("../../src/lib/stripe");
    validadeAnual = (s) => validadeDoPlano(PLANS.pro_anual, quando(s)).toISOString();
  });

  it("invoice.paid ANTES do completed: o pagamento cria a linha com o período; o completed depois não escreve", async () => {
    instalar(null);
    assert.equal((await primeira("evt_p1", CRIADO, fim(365))).status, 200);
    const criada = doUsuario("u-alvo")!;
    assert.equal(criada.plan, "PREMIUM");
    assert.equal(criada.status, "ACTIVE");
    assert.equal(criada.provider, "STRIPE");
    assert.equal(criada.externalId, ALVO);
    assert.equal(criada.storeProductId, null);
    assert.equal(criada.canceledAt, null);
    assert.deepEqual(criada.startedAt, quando(CRIADO));
    assert.deepEqual(criada.expiresAt, quando(fim(365)));
    assert.deepEqual(criada.stripeBase, { status: "ACTIVE", expiresAt: validadeAnual(CRIADO), canceledAt: null });

    assert.equal((await concluido("evt_c1", CRIADO + 1)).status, 200);
    assert.deepEqual(doUsuario("u-alvo"), criada, "completed da mesma sub não escreve nada");
    // Cada um sob a trava da pessoa (issue #359) e, dentro dela, o MESMO lock da sub.
    assert.deepEqual(travas, ["u-alvo", ALVO, "u-alvo", ALVO], "o completed usa o MESMO lock da sub");
    outraIntacta();
  });

  it("completed ANTES, com o invoice.paid de created ANTERIOR (como na Stripe): o período é aplicado", async () => {
    instalar(null);
    assert.equal((await concluido("evt_c1", CRIADO + 1)).status, 200);
    const provisoria = doUsuario("u-alvo")!;
    assert.deepEqual(provisoria.expiresAt, new Date(validadeAnual(CRIADO + 1)));
    assert.deepEqual(provisoria.stripeBase, { status: "ACTIVE", expiresAt: validadeAnual(CRIADO + 1), canceledAt: null });

    assert.equal((await primeira("evt_p1", CRIADO, fim(365))).status, 200);
    const paga = doUsuario("u-alvo")!;
    assert.deepEqual(paga.expiresAt, quando(fim(365)));
    assert.deepEqual(paga.startedAt, quando(CRIADO + 1), "o vínculo é do completed");
    assert.deepEqual(paga.stripeBase, provisoria.stripeBase, "a base não muda com eventos");
    outraIntacta();
  });

  it("legado sem metadados: invoice.paid ANTES do completed fica guardado e entra no período sem reenvio", async () => {
    instalar(null);
    assert.equal((await pago("evt_p1", CRIADO, fim(365), {})).status, 200);
    assert.equal(doUsuario("u-alvo"), null, "sem metadados não há a quem vincular");
    assert.equal(eventos.length, 1);

    assert.equal((await concluido("evt_c1", CRIADO + 1)).status, 200);
    const l = doUsuario("u-alvo")!;
    assert.equal(l.status, "ACTIVE");
    assert.deepEqual(l.expiresAt, quando(fim(365)), "fim do período exato, sem reenvio");
  });

  it("reentrega de cada evento não escreve nada (foto inclui updatedAt) e o evento fica guardado uma vez", async () => {
    instalar(null);
    await concluido("evt_c1", CRIADO + 1);
    await primeira("evt_p1", CRIADO, fim(30));
    let foto = doUsuario("u-alvo");
    assert.equal((await concluido("evt_c1", CRIADO + 1)).status, 200);
    assert.equal((await primeira("evt_p1", CRIADO, fim(30))).status, 200);
    assert.deepEqual(doUsuario("u-alvo"), foto, "completed e invoice.paid repetidos");

    assert.equal((await falhou("evt_f1", fim(30), fim(60), ALVO, "in_2")).status, 200);
    foto = doUsuario("u-alvo");
    assert.equal(foto!.status, "EXPIRED");
    assert.equal((await falhou("evt_f1", fim(30), fim(60), ALVO, "in_2")).status, 200);
    assert.deepEqual(doUsuario("u-alvo"), foto, "invoice.payment_failed repetido");

    assert.equal((await cancelado("evt_d1", fim(31))).status, 200);
    foto = doUsuario("u-alvo");
    assert.equal(foto!.status, "CANCELED");
    assert.equal((await cancelado("evt_d1", fim(31))).status, 200);
    assert.deepEqual(doUsuario("u-alvo"), foto, "customer.subscription.deleted repetido");

    assert.deepEqual(eventos.map((e) => e.eventId), ["evt_p1", "evt_f1", "evt_d1"]);
    outraIntacta();
  });

  for (const { nome, a, b, esperado } of [
    {
      nome: "paga e falha de faturas diferentes do mesmo período: falha fechado",
      a: () => pago("evt_par_p", fim(30), fim(60), META, ALVO, "in_par_p"),
      b: () => falhou("evt_par_f", fim(30), fim(60), ALVO, "in_par_f"),
      esperado: () => ({ status: "EXPIRED", expiresAt: quando(fim(30)), canceledAt: quando(fim(30)) }),
    },
    {
      nome: "falha da fatura antiga e paga da mais nova: ativa até o período novo",
      a: () => falhou("evt_par_f", fim(30), fim(30), ALVO, "in_antiga"),
      b: () => pago("evt_par_p", fim(30), fim(60), META, ALVO, "in_nova"),
      esperado: () => ({ status: "ACTIVE", expiresAt: quando(fim(60)), canceledAt: null }),
    },
  ]) {
    it(`mesmo segundo (${nome}): A→B→A→B e B→A→B→A terminam iguais, sem escrita nas reentregas`, async () => {
      const finais = [];
      for (const ordem of [[a, b, a, b], [b, a, b, a]]) {
        instalar({ status: "ACTIVE" });
        const fotos = [];
        for (const envio of ordem) {
          assert.equal((await envio()).status, 200);
          fotos.push(doUsuario("u-alvo"));
        }
        assert.deepEqual(fotos[2], fotos[1]);
        assert.deepEqual(fotos[3], fotos[1]);
        const { status, expiresAt, canceledAt } = fotos[3]!;
        finais.push({ status, expiresAt, canceledAt });
      }
      assert.deepEqual(finais[0], esperado());
      assert.deepEqual(finais[1], finais[0]);
    });
  }

  it("falha antiga chegando depois de um pagamento mais recente: segue ACTIVE", async () => {
    instalar({ status: "ACTIVE" });
    // A renovação (in_2) falhou em fim(30) e foi paga na nova tentativa em fim(32).
    await pago("evt_p2", fim(32), fim(60), META, ALVO, "in_2");
    const foto = doUsuario("u-alvo");
    assert.equal((await falhou("evt_f1", fim(30), fim(60), ALVO, "in_2")).status, 200);
    assert.deepEqual(doUsuario("u-alvo"), foto);
    assert.equal(foto!.status, "ACTIVE");
    assert.deepEqual(foto!.expiresAt, quando(fim(60)));
  });

  it("falha antiga chegando depois da exclusão: expiresAt = corte", async () => {
    instalar(null);
    await concluido("evt_c1", CRIADO + 1);
    await pago("evt_p1", CRIADO, fim(60));
    await cancelado("evt_d1", fim(40));
    assert.deepEqual(doUsuario("u-alvo")!.expiresAt, quando(fim(60)), "cancelada: vale até o fim pago");
    // Fatura avulsa do mesmo período, nunca paga: o período fica em aberto.
    assert.equal((await falhou("evt_f1", fim(35), fim(60), ALVO, "in_avulsa")).status, 200);
    const l = doUsuario("u-alvo")!;
    assert.equal(l.status, "CANCELED");
    assert.deepEqual(l.expiresAt, quando(fim(35)), "o corte entra antes da exclusão");
    assert.deepEqual(l.canceledAt, quando(fim(40)));
  });

  it("falha DISTINTA com a linha já EXPIRED: o corte da primeira falha é preservado", async () => {
    instalar({ status: "ACTIVE" });
    await falhou("evt_f1", fim(30), fim(60), ALVO, "in_2");
    const foto = doUsuario("u-alvo");
    assert.deepEqual(foto!.expiresAt, quando(fim(30)));
    assert.equal((await falhou("evt_f2", fim(33), fim(60), ALVO, "in_2")).status, 200);
    assert.deepEqual(doUsuario("u-alvo"), foto);
  });

  it("ciclo: renovação, falha, nova tentativa paga, cancelamento; completed atrasado não reativa", async () => {
    instalar(null);
    await concluido("evt_c1", CRIADO + 1);
    await primeira("evt_p1", CRIADO, fim(30));
    await pago("evt_p2", fim(30), fim(60));
    assert.deepEqual(doUsuario("u-alvo")!.expiresAt, quando(fim(60)), "renovação");
    await falhou("evt_f3", fim(60), fim(90), ALVO, "in_3");
    assert.equal(doUsuario("u-alvo")!.status, "EXPIRED");
    await pago("evt_p3", fim(62), fim(90), META, ALVO, "in_3");
    assert.equal(doUsuario("u-alvo")!.status, "ACTIVE", "a nova tentativa paga reativa");
    await cancelado("evt_d1", fim(70));
    const l = doUsuario("u-alvo")!;
    assert.equal(l.status, "CANCELED");
    assert.deepEqual(l.canceledAt, quando(fim(70)));
    assert.deepEqual(l.expiresAt, quando(fim(90)), "cancelou: vale até o fim do que pagou");

    assert.equal((await concluido("evt_c1", CRIADO + 1)).status, 200);
    assert.equal((await concluido("evt_c1_outro", fim(71))).status, 200);
    assert.deepEqual(doUsuario("u-alvo"), l, "completed da mesma sub não reativa");
    outraIntacta();
  });

  it("completed de compra ANTIGA depois de uma compra nova: ignorado; o de compra mais nova troca o vínculo", async () => {
    instalar(null);
    await concluido("evt_c_nova", CRIADO + 100, "sub_nova_342");
    const foto = doUsuario("u-alvo");
    assert.equal((await concluido("evt_c_velha", CRIADO + 50, "sub_velha_342")).status, 200);
    assert.deepEqual(doUsuario("u-alvo"), foto, "compra antiga não toma o lugar da nova");

    assert.equal((await concluido("evt_c_mais_nova", CRIADO + 200, "sub_mais_nova_342")).status, 200);
    const trocada = doUsuario("u-alvo")!;
    assert.equal(trocada.externalId, "sub_mais_nova_342");
    assert.deepEqual(trocada.startedAt, quando(CRIADO + 200));
    assert.deepEqual(trocada.stripeBase, { status: "ACTIVE", expiresAt: validadeAnual(CRIADO + 200), canceledAt: null });
    // Trocar o vínculo não encerra a anterior na Stripe: o cancelamento fica gravado na mesma transação.
    assert.deepEqual(
      operacoes.map(({ userId, tipo, status, externalId, substituida }) => ({ userId, tipo, status, externalId, substituida })),
      [{ userId: "u-alvo", tipo: "cancelar_substituida", status: "pendente", externalId: "sub_mais_nova_342", substituida: "sub_nova_342" }],
    );
  });

  it("invoice.paid de outra assinatura com vínculo mais recente na pessoa: nada escrito na linha", async () => {
    instalar(null);
    await concluido("evt_c_nova", CRIADO + 100, "sub_nova_342");
    const foto = doUsuario("u-alvo");
    assert.equal((await primeira("evt_p_velha", CRIADO, fim(30), META, "sub_velha_342")).status, 200);
    assert.deepEqual(doUsuario("u-alvo"), foto);
  });

  for (const ordem of [["pago", "concluido"], ["concluido", "pago"], ["pago", "concluido", "pago", "concluido"]]) {
    it(`invoice.paid e completed SIMULTÂNEOS, sem linha (${ordem.join(", ")}): período da fatura`, async () => {
      instalar(null);
      const status = await Promise.all(
        ordem.map((e) => (e === "pago" ? primeira("evt_p1", CRIADO, fim(365)) : concluido("evt_c1", CRIADO + 1)).then((r) => r.status)),
      );
      assert.deepEqual(status, ordem.map(() => 200));
      const l = doUsuario("u-alvo")!;
      assert.equal(l.status, "ACTIVE");
      assert.equal(l.externalId, ALVO);
      assert.deepEqual(l.expiresAt, quando(fim(365)));
      outraIntacta();
    });
  }

  // ── B1: renovação nunca cria nem troca vínculo ──────────────────────────
  it("renovação (subscription_cycle) com metadados, sem linha nenhuma: não cria vínculo, só guarda o evento", async () => {
    instalar(null);
    assert.equal((await pago("evt_r1", fim(30), fim(60))).status, 200);
    assert.equal(doUsuario("u-alvo"), null);
    assert.ok(!chamadas.includes("subscription.createMany"), "nenhuma tentativa de vínculo");
    assert.ok(!chamadas.includes("user.findUnique"));
    assert.deepEqual(eventos.map((e) => e.eventId), ["evt_r1"]);
  });

  it("fatura sem billing_reason: também não cria vínculo", async () => {
    instalar(null);
    const semMotivo = fatura(ALVO, fim(30), META, "in_evt_p1");
    assert.equal("billing_reason" in JSON.parse(JSON.stringify(semMotivo)), false);
    assert.equal((await enviar("invoice.paid", semMotivo, { id: "evt_p1", criado: CRIADO })).status, 200);
    assert.equal(doUsuario("u-alvo"), null);
    assert.equal(eventos.length, 1);
  });

  it("renovação da assinatura SUBSTITUÍDA depois da troca: plano, vínculo e validade não mudam; reentrega idem", async () => {
    instalar(null);
    await concluido("evt_c_antiga", CRIADO + 1, "sub_antiga_342");
    await concluido("evt_c_nova", CRIADO + 10 * DIA, "sub_nova_342");
    const foto = doUsuario("u-alvo");
    assert.equal(foto!.externalId, "sub_nova_342");
    for (let i = 0; i < 2; i++) {
      assert.equal((await pago("evt_r_antiga", fim(30), fim(60), META, "sub_antiga_342")).status, 200);
      assert.deepEqual(doUsuario("u-alvo"), foto);
    }
    assert.equal(eventos.filter((e) => e.eventId === "evt_r_antiga").length, 1);
  });

  // ── B2: base legada ─────────────────────────────────────────────────────
  it("linha legada + paga histórica: validade mantida, base legada gravada em UMA escrita; reentrega e outra histórica não escrevem", async () => {
    instalar({ status: "ACTIVE" }); // stripeBase nulo, expiresAt 2026-10-15
    const antes = copia(ALVO);
    assert.equal((await pago("evt_hist", CRIADO, fim(10))).status, 200);
    const depois = copia(ALVO);
    assert.deepEqual(
      { status: depois.status, expiresAt: depois.expiresAt, canceledAt: depois.canceledAt },
      { status: antes.status, expiresAt: antes.expiresAt, canceledAt: antes.canceledAt },
      "a fatura histórica não reduz a validade legada",
    );
    assert.notDeepEqual(depois.updatedAt, antes.updatedAt, "a inicialização da base é uma escrita");
    assert.deepEqual(depois.stripeBase, {
      status: "ACTIVE",
      expiresAt: "2026-10-15T00:00:00.000Z",
      canceledAt: null,
      origem: "legado",
      periodoReconhecido: "2026-10-15T00:00:00.000Z",
    });
    assert.equal((await pago("evt_hist", CRIADO, fim(10))).status, 200);
    assert.deepEqual(copia(ALVO), depois, "reentrega: nenhuma escrita");
    assert.equal((await falhou("evt_hist_f", CRIADO + 3600, fim(10))).status, 200);
    assert.deepEqual(copia(ALVO), depois, "outra fatura histórica: nenhuma escrita");
  });

  it("invoice.paid sem linha com usuário dos metadados inexistente: só o evento fica guardado", async () => {
    instalar(null, { semUsuario: true });
    const antes = structuredClone(banco);
    assert.equal((await primeira("evt_p1", CRIADO, fim(30))).status, 200);
    assert.deepEqual(banco, antes);
    assert.ok(!chamadas.includes("subscription.createMany"));
    assert.equal(eventos.length, 1);
    assert.ok(erros.some((e) => String(e[0]).includes("não existe")));
  });

  for (const [nome, metadata] of [
    ["sem userId", { planId: "pro_anual" }],
    ["sem plano", { userId: "u-alvo" }],
    ["plano desconhecido", { userId: "u-alvo", planId: "plano_que_nao_existe" }],
  ] as const) {
    it(`invoice.paid sem linha e metadados ${nome}: só o evento fica guardado`, async () => {
      instalar(null);
      const antes = structuredClone(banco);
      assert.equal((await primeira("evt_p1", CRIADO, fim(30), metadata)).status, 200);
      assert.deepEqual(banco, antes);
      assert.ok(!chamadas.includes("user.findUnique"));
      assert.equal(eventos.length, 1);
    });
  }

  for (const [nome, opcoes] of [
    ["sem created", { id: "evt_sem_created", criado: null }],
    ["created não inteiro", { id: "evt_created_ruim", criado: 1.5 }],
    ["id vazio", { id: "", criado: CRIADO }],
  ] as const) {
    it(`evento de assinatura ${nome}: nada escrito e erro no log`, async () => {
      instalar({ status: "ACTIVE" });
      const antes = structuredClone(banco);
      for (const [tipo, objeto] of [
        ["invoice.paid", { object: "invoice", metadata: {}, ...fatura(ALVO, fim(30), META) }],
        ["invoice.payment_failed", { object: "invoice", metadata: {}, ...fatura(ALVO, fim(30)) }],
        ["customer.subscription.deleted", { id: ALVO, object: "subscription" }],
        ["checkout.session.completed", sessao("sub_nova_342")],
      ] as const) {
        assert.equal((await enviarEvento(tipo, objeto, opcoes)).status, 200);
      }
      assert.deepEqual(banco, antes);
      assert.deepEqual(chamadas, [], "nenhuma consulta nem escrita");
      assert.deepEqual(eventos, []);
      assert.equal(erros.filter((e) => String(e[0]).includes("sem id ou created")).length, 4);
    });
  }
});
