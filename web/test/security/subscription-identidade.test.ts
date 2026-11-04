import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { identidadeDoPlano, type RegistroDeAssinatura } from "../../src/lib/assinatura";
import { GET } from "../../src/app/api/me/subscription/route";
import { signToken } from "../../src/lib/auth";

const PRODUTO = "br.com.dular.montador.pro.mensal";
const usuario = "assinante-montador-teste";
function registro(campos: Partial<RegistroDeAssinatura> = {}): RegistroDeAssinatura {
  return { provider: "GOOGLE", plan: "PREMIUM", status: "ACTIVE", storeProductId: PRODUTO,
    startedAt: new Date("2026-01-01"), expiresAt: new Date("2099-01-01"), canceledAt: null, ...campos };
}
function request(token = signToken({ userId: usuario, role: "MONTADOR" })) {
  return new Request("https://dular.test/api/me/subscription", { headers: { Authorization: `Bearer ${token}` } });
}

beforeEach(() => {
  resetMockPrisma();
  mockPrisma.user.findUnique = async () => ({ status: "ATIVO", role: "MONTADOR", premiumIntroShownAt: null });
  mockPrisma.subscription.findUnique = async () => null;
  mockPrisma.assinaturaLoja.findMany = async () => [];
  mockPrisma.featureLimit.findUnique = async () => null;
});

test("identifica mensal e anual pelo produto confirmado, sem estimar pela validade", () => {
  const mensal = identidadeDoPlano(registro());
  assert.equal(mensal.planId, "montador_pro_mensal");
  assert.equal(mensal.name, "Pro Mensal");
  assert.equal(mensal.interval, "month");
  const anual = identidadeDoPlano(registro({ storeProductId: "br.com.dular.montador.pro.anual", expiresAt: new Date("2026-01-01T00:05:00Z") }));
  assert.equal(anual.planId, "montador_pro_anual");
  assert.equal(anual.interval, "year");
});

test("produto desconhecido ou incompatível com nível não ganha identidade de catálogo", () => {
  for (const r of [registro({ storeProductId: "produto-desconhecido" }), registro({ plan: "BASIC" })]) {
    const identidade = identidadeDoPlano(r);
    assert.equal(identidade.planId, null);
    assert.equal(identidade.name, null);
    assert.equal(identidade.interval, null);
  }
});

test("Stripe legado e ausência de assinatura não são rotulados mensal/anual", () => {
  const legado = identidadeDoPlano(registro({ provider: "STRIPE", storeProductId: null }));
  assert.equal(legado.provider, "STRIPE");
  assert.equal(legado.planId, null);
  assert.equal(legado.interval, null);
  assert.deepEqual(identidadeDoPlano(null), { provider: null, storeProductId: null, planId: null, name: null, interval: null });
});

test("endpoint devolve identidade da assinatura que concede o plano e preserva contrato de uso", async () => {
  mockPrisma.assinaturaLoja.findMany = async (args) => {
    assert.equal(args.where.userId, usuario);
    assert.equal(args.select.storeProductId, true);
    return [{ provider: "GOOGLE", storeProductId: PRODUTO, plan: "PREMIUM", compradaEm: new Date("2026-01-01"), expiraEm: new Date("2099-01-01") }];
  };
  const resposta = await GET(request());
  assert.equal(resposta.status, 200);
  const body = await resposta.json();
  assert.equal(body.plan, "PREMIUM");
  assert.equal(body.subscription.provider, "GOOGLE");
  assert.equal(body.subscription.storeProductId, PRODUTO);
  assert.equal(body.subscription.planId, "montador_pro_mensal");
  assert.equal(body.subscription.interval, "month");
  assert.equal(body.subscription.status, "ACTIVE");
  // `periodo`: aditivo (janela da contagem); sem limite no plano não há janela.
  assert.deepEqual(body.usage.solicitacoesMes, { used: 0, limit: null, allowed: true, periodo: null });
  assert.equal(body.premiumIntroShown, false);
});

test("endpoint sem assinatura não anuncia plano pago ou produto", async () => {
  const resposta = await GET(request());
  const body = await resposta.json();
  assert.equal(resposta.status, 200);
  assert.equal(body.plan, "FREE");
  assert.equal(body.subscription, null);
});

test("endpoint sem sessão válida não expõe assinatura", async () => {
  mockPrisma.subscription.findUnique = async () => { throw new Error("Não pode consultar assinatura sem sessão"); };
  const resposta = await GET(request("invalido"));
  assert.equal(resposta.status, 401);
  const body = await resposta.json();
  assert.equal(body.subscription, undefined);
});
