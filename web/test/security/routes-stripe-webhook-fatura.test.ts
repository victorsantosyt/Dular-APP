import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";

// Faturas (invoice.paid / invoice.payment_failed) com a assinatura em cada
// formato que a Stripe já usou. Assinatura HMAC REAL, gerada pelo próprio SDK
// com segredo fictício — nada de constructEvent mockado. Banco simulado em
// memória: o que vale é o efeito gravado, não o 200.

const SEGREDO = "whsec_ficticio_issue_342_somente_teste";
const ORIGINAL_ENV = { ...process.env };
const FIM_DO_PERIODO = 1_893_456_000; // 2030-01-01T00:00:00Z

type Linha = {
  id: string;
  userId: string;
  provider: string;
  externalId: string;
  status: string;
  canceledAt: Date | null;
  expiresAt: Date | null;
};

let banco: Linha[] = [];
let chamadas: string[] = [];
const erros: unknown[][] = [];
const errorOriginal = console.error;

function linha(externalId: string, userId: string, estado: Partial<Linha>): Linha {
  return {
    id: `row-${externalId}`,
    userId,
    provider: "STRIPE",
    externalId,
    status: "ACTIVE",
    canceledAt: null,
    expiresAt: new Date("2026-10-15T00:00:00Z"),
    ...estado,
  };
}

function casa(where: Record<string, unknown>, l: Linha) {
  return Object.entries(where).every(([k, v]) => (l as Record<string, unknown>)[k] === v);
}

function instalarBanco(estadoAlvo: Partial<Linha>) {
  banco = [
    linha("sub_alvo_342", "u-alvo", estadoAlvo),
    linha("sub_outra_342", "u-outra", { status: "ACTIVE", expiresAt: new Date("2026-11-20T00:00:00Z") }),
  ];
  chamadas = [];
  mockPrisma.subscription.findFirst = async (args: { where: Record<string, unknown> }) => {
    chamadas.push("findFirst");
    const achada = banco.find((l) => casa(args.where, l));
    return achada ? { userId: achada.userId } : null;
  };
  mockPrisma.subscription.updateMany = async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
    chamadas.push("updateMany");
    let count = 0;
    for (const l of banco) {
      if (!casa(args.where, l)) continue;
      for (const [k, v] of Object.entries(args.data)) {
        if (v !== undefined) (l as Record<string, unknown>)[k] = v;
      }
      count += 1;
    }
    return { count };
  };
}

const copia = (externalId: string) => structuredClone(banco.find((l) => l.externalId === externalId)!);

async function enviar(tipo: string, fatura: Record<string, unknown>, opcoes: { adulterar?: (corpo: string) => string } = {}) {
  const { stripe } = await import("../../src/lib/stripe");
  const payload = JSON.stringify({
    id: `evt_test_342_${Math.random().toString(36).slice(2)}`,
    object: "event",
    type: tipo,
    api_version: "2025-03-31.basil",
    created: 1_790_000_000,
    livemode: false,
    data: { object: { id: "in_test_342", object: "invoice", metadata: {}, ...fatura } },
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

// ── Formatos de fatura ──────────────────────────────────────────────────────
const periodo = { start: FIM_DO_PERIODO - 30 * 86400, end: FIM_DO_PERIODO };
const linhaSemAssinatura = { id: "il_test_342", object: "line_item", period: periodo, subscription: null };
const linhas = (extra: Record<string, unknown> = {}) => ({
  object: "list",
  data: [{ ...linhaSemAssinatura, ...extra }],
});
const parentAssinatura = (subscription: unknown) => ({
  type: "subscription_details",
  quote_details: null,
  subscription_details: { metadata: {}, subscription },
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

describe("POST /api/webhooks/stripe — faturas (HMAC real, banco simulado)", () => {
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

  describe("invoice.paid", () => {
    const expirada = { status: "EXPIRED", canceledAt: new Date("2026-09-01T00:00:00Z"), expiresAt: new Date("2026-09-01T00:00:00Z") };

    for (const [nome, fatura] of reconhecidos) {
      it(`renova a assinatura certa: ${nome}`, async () => {
        instalarBanco(expirada);
        const outraAntes = copia("sub_outra_342");
        const res = await enviar("invoice.paid", fatura);
        assert.equal(res.status, 200);
        const alvo = copia(ALVO);
        assert.equal(alvo.status, "ACTIVE");
        assert.equal(alvo.canceledAt, null);
        assert.deepEqual(alvo.expiresAt, new Date(FIM_DO_PERIODO * 1000));
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
      });
    }

    it("assinatura que não está no banco: nada muda", async () => {
      instalarBanco(expirada);
      const antes = structuredClone(banco);
      const res = await enviar("invoice.paid", { parent: parentAssinatura("sub_inexistente_342"), lines: linhas() });
      assert.equal(res.status, 200);
      assert.deepEqual(banco, antes);
      assert.deepEqual(chamadas, ["findFirst"]);
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
        const t0 = Date.now();
        const res = await enviar("invoice.payment_failed", fatura);
        const t1 = Date.now();
        assert.equal(res.status, 200);
        const alvo = copia(ALVO);
        assert.equal(alvo.status, "EXPIRED");
        assert.ok(alvo.canceledAt && alvo.canceledAt.getTime() >= t0 && alvo.canceledAt.getTime() <= t1);
        assert.ok(alvo.expiresAt && alvo.expiresAt.getTime() >= t0 && alvo.expiresAt.getTime() <= t1);
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
