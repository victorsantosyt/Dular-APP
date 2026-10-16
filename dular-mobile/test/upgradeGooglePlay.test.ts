import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";
import { comprarAssinaturaGoogle, consultarDisponibilidadeGoogle, ErroCompraLoja } from "../src/lib/lojaGoogle";
import { podeFazerUpgradeGoogle } from "../src/components/ui/assinaturaPlano";

const antigo = "br.com.dular.montador.basico.mensal";
const novo = "br.com.dular.montador.pro.mensal";
const plano = { id: "montador_pro_mensal", plan: "PREMIUM", interval: "month", storeProductId: novo, storeBasePlanId: "mensal" };
const compraAntiga = { productId: antigo, purchaseToken: "token-antigo", purchaseState: "purchased" };
const estado = { plan: "BASIC", subscription: { provider: "GOOGLE", plan: "BASIC", status: "ACTIVE", planId: "montador_basico_mensal", name: "Básico Mensal", interval: "month", storeProductId: antigo, canceledAt: null, expiresAt: "2099-01-01" } };

function nativa(opcoes: { compras?: readonly any[]; ofertas?: any[]; falha?: boolean } = {}) {
  const chamadas: { nome: string; args?: any }[] = [];
  let receber: ((compra: any) => void) | null = null;
  const iap = {
    initConnection: async () => true,
    getAvailablePurchases: async () => [...(opcoes.compras ?? [compraAntiga])],
    fetchProducts: async () => {
      if (opcoes.falha) throw new Error("loja fora do ar");
      return opcoes.ofertas ?? [{ id: novo, subscriptionOfferDetailsAndroid: [{ basePlanId: "mensal", offerToken: "oferta" }] }];
    },
    purchaseUpdatedListener: (callback: any) => { receber = callback; return { remove() { receber = null; } }; },
    purchaseErrorListener: () => ({ remove() {} }),
    requestPurchase: async (args: any) => { chamadas.push({ nome: "requestPurchase", args }); receber?.({ productId: novo, purchaseToken: "token-novo", purchaseState: "purchased" }); return null; },
    finishTransaction: async () => { chamadas.push({ nome: "finish" }); },
  };
  return { iap, chamadas };
}

function fluxo(opcoes: { estado?: any; compras?: readonly any[]; falhaGet?: boolean; falhaValidacao?: boolean; mudouPlano?: boolean } = {}) {
  const loja = nativa({ compras: opcoes.compras });
  const passos: string[] = [];
  const requisitar = loja.iap.requestPurchase;
  loja.iap.requestPurchase = async (args) => { passos.push("folha"); return requisitar(args); };
  let consultas = 0;
  const api = {
    get: async (url: string) => {
      passos.push(url);
      if (opcoes.falhaGet) throw new Error("sem conexão");
      if (url === "/api/billing/plans") return { data: { plans: [plano] } };
      consultas += 1;
      return { data: consultas > 1 && opcoes.mudouPlano ? { plan: "FREE", subscription: null } : opcoes.estado ?? estado };
    },
    post: async (_url: string, body: any) => {
      passos.push(body.comprovante);
      if (body.comprovante === "token-antigo" && opcoes.falhaValidacao) throw { response: { status: 403 } };
      return { status: 200, data: { plan: body.comprovante === "token-antigo" ? "BASIC" : "PREMIUM" } };
    },
  };
  const codigo = transpileModule(readFileSync(join(import.meta.dirname, "../src/lib/compraDePlano.ts"), "utf8"), { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 } }).outputText;
  const adapters: Record<string, unknown> = {
    "react-native": { Platform: { OS: "android" }, Linking: {} },
    "@/lib/api": { api },
    "@/components/ui/assinaturaPlano": { podeFazerUpgradeGoogle },
    "@/lib/lojaGoogle": { ErroCompraLoja, comprarAssinaturaGoogle: (pedido: any) => comprarAssinaturaGoogle(pedido, loja.iap), concluirCompraGoogle: async () => passos.push("finish"), comprasParaRestaurarGoogle: async () => [] },
  };
  const modulo = { exports: {} as any };
  new Function("require", "module", "exports", codigo)((id: string) => { if (!(id in adapters)) throw new Error(id); return adapters[id]; }, modulo, modulo.exports);
  return { ...loja, passos, executar: () => modulo.exports.comprarPlano(plano, { loja: { android: true, ios: false }, stripe: false, tokenLoja: "conta" }) };
}

test("upgrade valida compra antiga autenticada antes da folha e substitui com crédito em tempo", async () => {
  const f = fluxo();
  assert.deepEqual(await f.executar(), { via: "loja", plano: "PREMIUM" });
  assert.deepEqual(f.chamadas.find((c) => c.nome === "requestPurchase")?.args.request.google, {
    skus: [novo], subscriptionOffers: [{ sku: novo, offerToken: "oferta" }], obfuscatedAccountId: "conta", purchaseToken: "token-antigo",
    subscriptionProductReplacementParams: { oldProductId: antigo, replacementMode: "with-time-proration" },
  });
  assert.ok(f.passos.indexOf("token-antigo") < f.passos.indexOf("folha"));
  assert.ok(f.passos.indexOf("folha") < f.passos.indexOf("token-novo"));
  assert.equal(f.passos.at(-1), "finish");
});

for (const [nome, opcoes] of [
  ["conta diferente", { falhaValidacao: true }],
  ["FREE com compra não restaurada", { estado: { plan: "FREE", subscription: null } }],
  ["consulta indisponível", { falhaGet: true }],
  ["compra antiga ausente", { compras: [] }],
  ["compra antiga ambígua", { compras: [compraAntiga, { ...compraAntiga, purchaseToken: "outro" }] }],
  ["estado mudou durante validação", { mudouPlano: true }],
  ["mesmo plano", { estado: { ...estado, plan: "PREMIUM", subscription: { ...estado.subscription, planId: plano.id, storeProductId: novo } } }],
  ["assinatura Stripe", { estado: { ...estado, subscription: { ...estado.subscription, provider: "STRIPE" } } }],
] as const) test(`upgrade não abre folha quando ${nome}`, async () => {
  const f = fluxo(opcoes);
  await assert.rejects(f.executar());
  assert.equal(f.chamadas.some((c) => c.nome === "requestPurchase"), false);
});

test("disponibilidade exige produto e base publicados sem oferta promocional", async () => {
  for (const [ofertas, esperado] of [
    [[{ id: novo, subscriptionOfferDetailsAndroid: [{ basePlanId: "mensal" }] }], [plano.id]],
    [[], []],
    [[{ id: novo, subscriptionOfferDetailsAndroid: [{ basePlanId: "anual" }] }], []],
    [[{ id: novo, subscriptionOfferDetailsAndroid: [{ basePlanId: "mensal", offerId: "promo" }] }], []],
  ] as const) {
    const { iap } = nativa({ ofertas: [...ofertas] });
    assert.deepEqual(await consultarDisponibilidadeGoogle([plano], iap), esperado);
  }
});

test("falha nativa não vira lista vazia nem ausência de plano", async () => {
  await assert.rejects(consultarDisponibilidadeGoogle([plano], nativa({ falha: true }).iap));
});

test("upgrade: compra antiga de outra conta Dular não é substituída", async () => {
  const { iap, chamadas } = nativa({ compras: [{ ...compraAntiga, obfuscatedAccountIdAndroid: "token-de-outra-conta" }] });
  await assert.rejects(comprarAssinaturaGoogle({
    produtoId: novo, planoBase: "mensal", tokenDaConta: "token-desta-conta",
    substituicao: { produtoId: antigo, validar: async () => {} },
  }, iap as any), (e: any) => e instanceof ErroCompraLoja && e.codigo === "UPGRADE_INDISPONIVEL");
  assert.equal(chamadas.length, 0);
});

test("renovação aguardando a loja bloqueia nova compra e avisa sem dizer que expirou", () => {
  const tela = readFileSync(join(import.meta.dirname, "..", "src", "screens", "PaywallScreen.tsx"), "utf8");
  assert.match(tela, /const renovacaoPendente = assinatura\.data\?\.verificacaoLoja === "pendente";/);
  assert.match(tela, /const compraBloqueada = [^\n]*\|\| renovacaoPendente;/);
  assert.match(tela, /renovacaoPendente \? \(/);
});

test("catálogo inicial e de troca listam só o que a Google Play oferece", () => {
  const tela = readFileSync(join(import.meta.dirname, "..", "src", "screens", "PaywallScreen.tsx"), "utf8");
  assert.match(tela, /const consultaLoja = exibicao === "catalogo" && Platform\.OS === "android" && lojaDisponivel\(pagamento\);/);
  assert.match(tela, /const alternativasVisiveis = consultaLoja\s*\? alternativas\.filter\(\(p\) => disponiveisGoogle\?\.includes\(p\.id\)\)/);
});
