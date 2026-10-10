import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";

// Compra de créditos pelo checkout (`checkout.session.completed`, mode
// "payment"): uma compra credita UMA vez, com saldo e extrato gravados juntos.
// Assinatura HMAC real do SDK com segredo fictício. Banco simulado com
// transação (tudo ou nada) e índice único do id da sessão, executando uma
// transação por vez — como o Postgres faz com duas escritas na mesma chave.
// A mesma bateria contra Postgres real: stripe-creditos-db.test.ts.

const SEGREDO = "whsec_ficticio_creditos_idempotentes";
const ORIGINAL_ENV = { ...process.env };
const errorOriginal = console.error;
const warnOriginal = console.warn;

type Carteira = { id: string; userId: string; balance: number };
type Lancamento = {
  id: string;
  walletId: string;
  type: string;
  amount: number;
  description?: string | null;
  stripeCheckoutSessionId?: string | null;
};
type Estado = { carteiras: Carteira[]; lancamentos: Lancamento[] };

let estado: Estado;
let seq = 0;
const falhar = { antesDoSaldo: 0, depoisDoSaldo: 0 };
const chamadas: string[] = [];

function operacoes(alvo: Estado) {
  return {
    creditWallet: {
      upsert: async ({ where, update, create }: { where: { userId: string }; update: { balance: { increment: number } }; create: { userId: string; balance: number } }) => {
        chamadas.push("creditWallet.upsert");
        if (falhar.antesDoSaldo > 0) {
          falhar.antesDoSaldo -= 1;
          throw new Error("falha simulada antes de somar o saldo");
        }
        let c = alvo.carteiras.find((x) => x.userId === where.userId);
        if (c) c.balance += update.balance.increment;
        else alvo.carteiras.push((c = { id: `wallet-${++seq}`, userId: create.userId, balance: create.balance }));
        return { ...c };
      },
    },
    creditTransaction: {
      create: async ({ data }: { data: Omit<Lancamento, "id"> }) => {
        chamadas.push("creditTransaction.create");
        if (falhar.depoisDoSaldo > 0) {
          falhar.depoisDoSaldo -= 1;
          throw new Error("falha simulada depois de somar o saldo");
        }
        const sessao = data.stripeCheckoutSessionId;
        if (sessao && alvo.lancamentos.some((l) => l.stripeCheckoutSessionId === sessao)) {
          throw Object.assign(new Error("Unique constraint failed on the fields: (`stripeCheckoutSessionId`)"), { code: "P2002" });
        }
        const l = { id: `tx-${++seq}`, ...data };
        alvo.lancamentos.push(l);
        return l;
      },
      findUnique: async ({ where }: { where: { stripeCheckoutSessionId: string } }) => {
        chamadas.push("creditTransaction.findUnique");
        const l = alvo.lancamentos.find((x) => x.stripeCheckoutSessionId === where.stripeCheckoutSessionId);
        return l ? { id: l.id } : null;
      },
    },
  };
}

function instalarBanco() {
  estado = {
    carteiras: [{ id: "wallet-outro", userId: "u-outro", balance: 7 }],
    lancamentos: [{ id: "tx-outro", walletId: "wallet-outro", type: "CREDIT", amount: 7, description: "anterior", stripeCheckoutSessionId: null }],
  };
  falhar.antesDoSaldo = 0;
  falhar.depoisDoSaldo = 0;
  chamadas.length = 0;
  const direto = operacoes(estado);
  mockPrisma.creditWallet.upsert = direto.creditWallet.upsert;
  mockPrisma.creditTransaction.create = direto.creditTransaction.create;
  mockPrisma.creditTransaction.findUnique = direto.creditTransaction.findUnique;

  // Transação: trabalha numa cópia; grava tudo no fim ou descarta tudo.
  let fila: Promise<unknown> = Promise.resolve();
  mockPrisma.$transaction = (fn: (tx: unknown) => Promise<unknown>) => {
    const vez = fila.then(async () => {
      const copia: Estado = structuredClone(estado);
      const resultado = await fn(operacoes(copia));
      estado.carteiras = copia.carteiras;
      estado.lancamentos = copia.lancamentos;
      return resultado;
    });
    fila = vez.catch(() => {});
    return vez;
  };
}

const saldo = (userId: string) => estado.carteiras.find((c) => c.userId === userId)?.balance;
const doUsuario = (userId: string) => {
  const c = estado.carteiras.find((x) => x.userId === userId);
  return c ? estado.lancamentos.filter((l) => l.walletId === c.id) : [];
};
const outroIntacto = () => {
  assert.deepEqual(estado.carteiras.find((c) => c.userId === "u-outro"), { id: "wallet-outro", userId: "u-outro", balance: 7 });
  assert.equal(doUsuario("u-outro").length, 1);
};

const compra = (credits: unknown, extra: Record<string, unknown> = {}) => ({
  id: "cs_test_ficticio_compra_1",
  object: "checkout.session",
  mode: "payment",
  payment_status: "paid",
  client_reference_id: "u-compra",
  metadata: { credits },
  ...extra,
});

async function enviar(
  sessao: Record<string, unknown>,
  opcoes: { idEvento?: string; tipo?: string; adulterar?: (c: string) => string } = {},
) {
  const { stripe } = await import("../../src/lib/stripe");
  const payload = JSON.stringify({
    id: opcoes.idEvento ?? `evt_ficticio_${++seq}`,
    object: "event",
    type: opcoes.tipo ?? "checkout.session.completed",
    api_version: "2026-04-22.dahlia",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    data: { object: sessao },
  });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: SEGREDO });
  const mod = await import("../../src/app/api/webhooks/stripe/route");
  const res = await mod.POST(
    new Request("http://test/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": header },
      body: opcoes.adulterar ? opcoes.adulterar(payload) : payload,
    }),
  );
  return res.status;
}

describe("checkout.session.completed — compra de créditos idempotente", () => {
  beforeEach(() => {
    resetMockPrisma();
    instalarBanco();
    process.env.STRIPE_WEBHOOK_SECRET = SEGREDO;
    delete process.env.STRIPE_WEBHOOK_ALLOW_UNSIGNED_DEV;
    console.error = () => {};
    console.warn = () => {};
  });
  after(() => {
    console.error = errorOriginal;
    console.warn = warnOriginal;
    process.env.STRIPE_WEBHOOK_SECRET = ORIGINAL_ENV.STRIPE_WEBHOOK_SECRET;
  });

  it("uma entrega válida: +5 e UM lançamento com o id da sessão", async () => {
    assert.equal(await enviar(compra("5")), 200);
    assert.equal(saldo("u-compra"), 5);
    const l = doUsuario("u-compra");
    assert.equal(l.length, 1);
    assert.equal(l[0].amount, 5);
    assert.equal(l[0].type, "CREDIT");
    assert.equal(l[0].stripeCheckoutSessionId, "cs_test_ficticio_compra_1");
    outroIntacto();
  });

  it("carteira existente: soma ao saldo anterior", async () => {
    estado.carteiras.push({ id: "wallet-compra", userId: "u-compra", balance: 3 });
    assert.equal(await enviar(compra("5")), 200);
    assert.equal(saldo("u-compra"), 8);
    assert.equal(doUsuario("u-compra").length, 1);
  });

  it("duas entregas sequenciais do MESMO evento: +5 uma vez só", async () => {
    assert.equal(await enviar(compra("5"), { idEvento: "evt_ficticio_repetido" }), 200);
    assert.equal(await enviar(compra("5"), { idEvento: "evt_ficticio_repetido" }), 200);
    assert.equal(saldo("u-compra"), 5);
    assert.equal(doUsuario("u-compra").length, 1);
    outroIntacto();
  });

  it("três entregas SIMULTÂNEAS do mesmo evento: +5 uma vez só, todas 200", async () => {
    const status = await Promise.all([1, 2, 3].map(() => enviar(compra("5"), { idEvento: "evt_ficticio_paralelo" })));
    assert.deepEqual(status, [200, 200, 200]);
    assert.equal(saldo("u-compra"), 5);
    assert.equal(doUsuario("u-compra").length, 1);
    outroIntacto();
  });

  it("mesma sessão em eventos DIFERENTES: +5 uma vez só", async () => {
    assert.equal(await enviar(compra("5"), { idEvento: "evt_ficticio_a" }), 200);
    assert.equal(await enviar(compra("5"), { idEvento: "evt_ficticio_b" }), 200);
    assert.equal(saldo("u-compra"), 5);
    assert.equal(doUsuario("u-compra").length, 1);
  });

  it("sessões diferentes do mesmo usuário: cada compra credita", async () => {
    await enviar(compra("5"));
    await enviar(compra("3", { id: "cs_test_ficticio_compra_2" }));
    assert.equal(saldo("u-compra"), 8);
    assert.equal(doUsuario("u-compra").length, 2);
  });

  it("falha ANTES de somar o saldo: 500 sem gravar nada; o reenvio credita uma vez", async () => {
    falhar.antesDoSaldo = 1;
    assert.equal(await enviar(compra("5")), 500);
    assert.equal(saldo("u-compra"), undefined);
    assert.equal(doUsuario("u-compra").length, 0);
    assert.equal(await enviar(compra("5")), 200);
    assert.equal(saldo("u-compra"), 5);
    assert.equal(doUsuario("u-compra").length, 1);
    outroIntacto();
  });

  it("falha DEPOIS de somar o saldo e antes do extrato: 500 e o saldo NÃO fica somado", async () => {
    estado.carteiras.push({ id: "wallet-compra", userId: "u-compra", balance: 3 });
    falhar.depoisDoSaldo = 1;
    assert.equal(await enviar(compra("5")), 500);
    assert.equal(saldo("u-compra"), 3, "saldo parcial desfeito");
    assert.equal(doUsuario("u-compra").length, 0);
  });

  it("reenvio depois dessa falha: credita exatamente uma vez", async () => {
    falhar.depoisDoSaldo = 1;
    assert.equal(await enviar(compra("5")), 500);
    assert.equal(await enviar(compra("5")), 200);
    assert.equal(await enviar(compra("5")), 200);
    assert.equal(saldo("u-compra"), 5);
    assert.equal(doUsuario("u-compra").length, 1);
    outroIntacto();
  });

  for (const [nome, credits] of [
    ["texto", "abc"],
    ["zero", "0"],
    ["negativo", "-3"],
    ["decimal", "2.5"],
    ["notação científica", "1e3"],
    ["com espaço", " 5"],
    ["número seguido de texto", "5abc"],
    ["acima do máximo", "1001"],
    ["excessivo", "999999999999"],
    ["ausente", undefined],
    ["número em vez de texto", 5],
  ] as const) {
    it(`quantidade inválida (${nome}): 200 e nada gravado`, async () => {
      const antes = structuredClone(estado);
      assert.equal(await enviar(compra(credits)), 200);
      assert.deepEqual(estado, antes);
      assert.deepEqual(chamadas, [], "nenhuma escrita tentada");
    });
  }

  it("quantidade no limite (1000): credita", async () => {
    assert.equal(await enviar(compra("1000")), 200);
    assert.equal(saldo("u-compra"), 1000);
  });

  it("sessão sem id de checkout válido: nada gravado", async () => {
    const antes = structuredClone(estado);
    assert.equal(await enviar(compra("5", { id: undefined })), 200);
    assert.equal(await enviar(compra("5", { id: "pi_nao_e_sessao" })), 200);
    assert.deepEqual(estado, antes);
  });

  it("payload adulterado depois de assinado: 400 e nada gravado", async () => {
    const antes = structuredClone(estado);
    assert.equal(await enviar(compra("5"), { adulterar: (c) => c.replace('"credits":"5"', '"credits":"500"') }), 400);
    assert.deepEqual(estado, antes);
    assert.deepEqual(chamadas, []);
  });

  // ── Confirmação do pagamento (boleto/Pix) ───────────────────────────────
  describe("confirmação do pagamento", () => {
    const SUCESSO = "checkout.session.async_payment_succeeded";
    const RECUSA = "checkout.session.async_payment_failed";
    const pendente = () => compra("5", { payment_status: "unpaid" });
    const paga = () => compra("5", { payment_status: "paid" });

    it("completed com pagamento pendente: nada creditado", async () => {
      assert.equal(await enviar(pendente()), 200);
      assert.equal(saldo("u-compra"), undefined);
      assert.deepEqual(chamadas, [], "nenhuma escrita tentada");
      outroIntacto();
    });

    it("só a confirmação assíncrona (paid): credita +5 uma vez", async () => {
      assert.equal(await enviar(paga(), { tipo: SUCESSO }), 200);
      assert.equal(saldo("u-compra"), 5);
      assert.equal(doUsuario("u-compra").length, 1);
      outroIntacto();
    });

    it("pendente e depois confirmado: credita +5 uma vez", async () => {
      assert.equal(await enviar(pendente()), 200);
      assert.equal(await enviar(paga(), { tipo: SUCESSO }), 200);
      assert.equal(saldo("u-compra"), 5);
      assert.equal(doUsuario("u-compra").length, 1);
      assert.equal(doUsuario("u-compra")[0].stripeCheckoutSessionId, "cs_test_ficticio_compra_1");
      outroIntacto();
    });

    it("confirmação entregue duas vezes: +5 uma vez", async () => {
      await enviar(pendente());
      assert.equal(await enviar(paga(), { tipo: SUCESSO, idEvento: "evt_ficticio_confirmado" }), 200);
      assert.equal(await enviar(paga(), { tipo: SUCESSO, idEvento: "evt_ficticio_confirmado" }), 200);
      assert.equal(saldo("u-compra"), 5);
      assert.equal(doUsuario("u-compra").length, 1);
    });

    it("três confirmações simultâneas: +5 uma vez, todas 200", async () => {
      const status = await Promise.all([1, 2, 3].map(() => enviar(paga(), { tipo: SUCESSO })));
      assert.deepEqual(status, [200, 200, 200]);
      assert.equal(saldo("u-compra"), 5);
      assert.equal(doUsuario("u-compra").length, 1);
    });

    it("completed já pago E confirmação assíncrona da mesma sessão: +5 uma vez", async () => {
      await enviar(paga());
      await enviar(paga(), { tipo: SUCESSO });
      assert.equal(saldo("u-compra"), 5);
      assert.equal(doUsuario("u-compra").length, 1);
    });

    it("completed pago e confirmação da mesma sessão SIMULTÂNEOS: +5 uma vez, todas 200", async () => {
      const status = await Promise.all([
        enviar(paga()),
        enviar(paga(), { tipo: SUCESSO }),
        enviar(paga()),
        enviar(paga(), { tipo: SUCESSO }),
      ]);
      assert.deepEqual(status, [200, 200, 200, 200]);
      assert.equal(saldo("u-compra"), 5);
      assert.equal(doUsuario("u-compra").length, 1);
      outroIntacto();
    });

    it("confirmação chega ANTES do completed pendente: +5 uma vez", async () => {
      assert.equal(await enviar(paga(), { tipo: SUCESSO }), 200);
      assert.equal(await enviar(pendente()), 200);
      assert.equal(saldo("u-compra"), 5);
      assert.equal(doUsuario("u-compra").length, 1);
    });

    it("pagamento recusado: nada creditado, nem antes nem depois", async () => {
      const antes = structuredClone(estado);
      assert.equal(await enviar(pendente()), 200);
      assert.equal(await enviar(compra("5", { payment_status: "unpaid" }), { tipo: RECUSA }), 200);
      assert.deepEqual(estado, antes);
      assert.deepEqual(chamadas, []);
    });

    for (const [nome, payment_status] of [
      ["sem payment_status", undefined],
      ["total zero (no_payment_required)", "no_payment_required"],
      ["status desconhecido", "processing"],
    ] as const) {
      it(`completed ${nome}: nada creditado`, async () => {
        const antes = structuredClone(estado);
        assert.equal(await enviar(compra("5", { payment_status })), 200);
        assert.deepEqual(estado, antes);
      });
    }

    it("confirmação assíncrona que não diz 'paid': nada creditado", async () => {
      const antes = structuredClone(estado);
      assert.equal(await enviar(pendente(), { tipo: SUCESSO }), 200);
      assert.deepEqual(estado, antes);
    });

    it("confirmação com quantidade inválida: nada creditado", async () => {
      const antes = structuredClone(estado);
      assert.equal(await enviar(compra("2.5", { payment_status: "paid" }), { tipo: SUCESSO }), 200);
      assert.deepEqual(estado, antes);
      assert.deepEqual(chamadas, []);
    });

    it("confirmação sem id de sessão cs_: nada creditado", async () => {
      const antes = structuredClone(estado);
      assert.equal(await enviar(compra("5", { payment_status: "paid", id: "pi_nao_e_sessao" }), { tipo: SUCESSO }), 200);
      assert.equal(await enviar(compra("5", { payment_status: "paid", id: undefined }), { tipo: SUCESSO }), 200);
      assert.deepEqual(estado, antes);
      assert.deepEqual(chamadas, []);
    });

    it("confirmação sem usuário: nada creditado", async () => {
      const antes = structuredClone(estado);
      assert.equal(await enviar(compra("5", { payment_status: "paid", client_reference_id: null }), { tipo: SUCESSO }), 200);
      assert.deepEqual(estado, antes);
    });

    it("eventos assíncronos de ASSINATURA não mexem em créditos nem em assinaturas", async () => {
      const antes = structuredClone(estado);
      const tocadas: string[] = [];
      mockPrisma.subscription.upsert = async () => void tocadas.push("upsert");
      mockPrisma.subscription.updateMany = async () => void tocadas.push("updateMany");
      (mockPrisma.subscription as Record<string, unknown>).createMany = async () => void tocadas.push("createMany");
      mockPrisma.subscription.findFirst = async () => void tocadas.push("findFirst");
      const transacaoDosCreditos = mockPrisma.$transaction;
      mockPrisma.$transaction = (fn: unknown) => {
        tocadas.push("$transaction");
        return transacaoDosCreditos(fn);
      };
      const assinatura = compra("5", { mode: "subscription", payment_status: "paid", subscription: "sub_ficticio" });
      assert.equal(await enviar(assinatura, { tipo: SUCESSO }), 200);
      assert.equal(await enviar(assinatura, { tipo: RECUSA }), 200);
      assert.deepEqual(estado, antes);
      assert.deepEqual(chamadas, []);
      assert.deepEqual(tocadas, []);
    });

    it("assinatura: o completed cria o vínculo (createMany), pago ou pendente, e não credita", async () => {
      const antes = structuredClone(estado);
      const vinculos: Array<Record<string, unknown>> = [];
      (mockPrisma.subscription as Record<string, unknown>).createMany = async (args: { data: Array<Record<string, unknown>> }) => {
        vinculos.push(args.data[0]);
        return { count: 1 };
      };
      const tocadas: string[] = [];
      mockPrisma.subscription.upsert = async () => void tocadas.push("upsert");
      mockPrisma.subscription.updateMany = async () => void tocadas.push("updateMany");
      // Assinatura não passa pela transação dos créditos: tem a sua, com o lock da sub.
      const travas: string[] = [];
      const txAssinatura = {
        $executeRaw: async (sql: TemplateStringsArray, ...valores: unknown[]) => {
          if (sql.join("?").includes("pg_advisory_xact_lock")) travas.push(String(valores[0]));
          return 1;
        },
        subscription: mockPrisma.subscription,
        stripeEventoAssinatura: { findMany: async () => [] },
        assinaturaLoja: { count: async () => 0 },
      };
      mockPrisma.subscription.findFirst = async () => null;
      mockPrisma.$transaction = async (fn: (tx: unknown) => Promise<unknown>) => fn(txAssinatura);
      // Prova de origem: a operação `checkout` que a rota gravou para cada compra.
      mockPrisma.stripeOperacao.findUnique = (async (args: { where: { chave: string } }) => ({
        tipo: "checkout", userId: args.where.chave.replace("prova-", ""), planId: "pro_mensal", referencia: null, externalId: null,
      })) as never;

      // Usuário e assinatura distintos: cada entrega é a primeira daquela compra.
      const segundos: Array<[number, number]> = [];
      for (const payment_status of ["paid", "unpaid"]) {
        const sessao = compra("5", {
          mode: "subscription",
          payment_status,
          client_reference_id: `u-assinatura-${payment_status}`,
          subscription: `sub_ficticio_fluxo_${payment_status}`,
          metadata: { planId: "pro_mensal", userId: `u-assinatura-${payment_status}`, operacao: `prova-u-assinatura-${payment_status}` },
        });
        const inicio = Math.floor(Date.now() / 1000);
        assert.equal(await enviar(sessao), 200);
        segundos.push([inicio, Math.floor(Date.now() / 1000)]);
      }

      assert.equal(vinculos.length, 2);
      vinculos.forEach((v, i) => {
        const payment_status = ["paid", "unpaid"][i];
        assert.equal(v.userId, `u-assinatura-${payment_status}`);
        assert.equal(v.status, "ACTIVE");
        assert.equal(v.externalId, `sub_ficticio_fluxo_${payment_status}`);
        // startedAt = `created` do evento (segundos inteiros), não a hora do servidor.
        const inicio = (v.startedAt as Date).getTime();
        assert.ok(v.startedAt instanceof Date && inicio % 1000 === 0, "startedAt vem do created do evento");
        assert.ok(inicio >= segundos[i][0] * 1000 && inicio <= segundos[i][1] * 1000);
        // Base do vínculo = validade provisória do plano a partir do created.
        assert.deepEqual(v.stripeBase, {
          status: "ACTIVE",
          expiresAt: (v.expiresAt as Date).toISOString(),
          canceledAt: null,
        });
      });
      // A trava da pessoa (issue #359) e, dentro dela, o lock da sub.
      assert.deepEqual(travas, ["u-assinatura-paid", "sub_ficticio_fluxo_paid", "u-assinatura-unpaid", "sub_ficticio_fluxo_unpaid"]);
      assert.deepEqual(tocadas, [], "primeira entrega: cria, sem upsert nem troca de vínculo");
      assert.deepEqual(estado, antes);
      assert.deepEqual(chamadas, [], "nenhum crédito");
    });

    it("falha real ao creditar a confirmação: 500 sem gravar; o reenvio credita uma vez", async () => {
      falhar.depoisDoSaldo = 1;
      assert.equal(await enviar(paga(), { tipo: SUCESSO }), 500);
      assert.equal(saldo("u-compra"), undefined);
      assert.equal(await enviar(paga(), { tipo: SUCESSO }), 200);
      assert.equal(saldo("u-compra"), 5);
      assert.equal(doUsuario("u-compra").length, 1);
    });

    it("confirmação adulterada depois de assinada: 400 e nada gravado", async () => {
      const antes = structuredClone(estado);
      const res = await enviar(paga(), { tipo: SUCESSO, adulterar: (c) => c.replace('"credits":"5"', '"credits":"50"') });
      assert.equal(res, 400);
      assert.deepEqual(estado, antes);
    });
  });
});
