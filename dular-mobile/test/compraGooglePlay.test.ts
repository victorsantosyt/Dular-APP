import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  ErroCompraLoja,
  comprarAssinaturaGoogle,
  comprasParaRestaurarGoogle,
  concluirCompraGoogle,
} from "../src/lib/lojaGoogle";

/**
 * Compra de assinatura na Google Play (issue #359), com uma expo-iap falsa.
 * O que importa: token da conta em toda compra, só o plano base do catálogo,
 * pendente nunca apresentado nem concluído, e conclusão só depois do servidor.
 */

const PRODUTO = "br.com.dular.diarista.pro.mensal";
const TOKEN_CONTA = "3f2a9c1e-0b4d-4e8a-9f6b-1c2d3e4f5a6b";

function lojaFalsa(opcoes: { compras?: unknown; erro?: unknown; disponiveis?: unknown[] } = {}) {
  const chamadas: { nome: string; args: any }[] = [];
  let atualizou: ((compra: any) => void) | null = null;
  let falhou: ((erro: any) => void) | null = null;
  const registrar = (nome: string) => async (args?: any) => {
    chamadas.push({ nome, args });
  };
  const iap = {
    purchaseUpdatedListener: (callback: any) => {
      atualizou = callback;
      return { remove: () => { atualizou = null; chamadas.push({ nome: "removeUpdated", args: null }); } };
    },
    purchaseErrorListener: (callback: any) => {
      falhou = callback;
      return { remove: () => { falhou = null; chamadas.push({ nome: "removeError", args: null }); } };
    },
    initConnection: async () => {
      chamadas.push({ nome: "initConnection", args: null });
      return true;
    },
    fetchProducts: async (args: any) => {
      chamadas.push({ nome: "fetchProducts", args });
      return [
        {
          id: PRODUTO,
          subscriptionOfferDetailsAndroid: [
            { basePlanId: "mensal", offerId: "promo-1", offerToken: "token-oferta-promo" },
            { basePlanId: "anual", offerId: null, offerToken: "token-base-anual" },
            { basePlanId: "mensal", offerId: null, offerToken: "token-base-mensal" },
          ],
        },
      ];
    },
    requestPurchase: async (args: any) => {
      chamadas.push({ nome: "requestPurchase", args });
      setTimeout(() => {
        if (opcoes.erro) { falhou?.(opcoes.erro); return; }
        for (const compra of (opcoes.compras ?? [{ productId: PRODUTO, purchaseToken: "comprovante-1", purchaseState: "purchased" }]) as any[]) atualizou?.(compra);
      }, 0);
      return undefined;
    },
    getAvailablePurchases: async () => {
      chamadas.push({ nome: "getAvailablePurchases", args: null });
      return opcoes.erro && chamadas.filter((c) => c.nome === "getAvailablePurchases").length === 1 ? [] : opcoes.disponiveis ?? [];
    },
    finishTransaction: registrar("finishTransaction"),
  };
  return { iap: iap as any, chamadas, pedidos: () => chamadas.filter((c) => c.nome === "requestPurchase") };
}

const pedido = { produtoId: PRODUTO, planoBase: "mensal", tokenDaConta: TOKEN_CONTA };

test("compra leva o token da conta e a oferta do PLANO BASE (não a promocional nem a de outro plano)", async () => {
  const { iap, pedidos } = lojaFalsa();
  const compra = await comprarAssinaturaGoogle(pedido, iap);
  const google = pedidos()[0].args.request.google;
  assert.equal(pedidos()[0].args.type, "subs");
  assert.equal(google.obfuscatedAccountId, TOKEN_CONTA);
  assert.deepEqual(google.skus, [PRODUTO]);
  assert.deepEqual(google.subscriptionOffers, [{ sku: PRODUTO, offerToken: "token-base-mensal" }]);
  assert.deepEqual({ ...compra, original: undefined }, { produtoId: PRODUTO, comprovante: "comprovante-1", pendente: false, original: undefined });
});

test("sem token da conta: não chega a pedir a compra", async () => {
  const { iap, chamadas } = lojaFalsa();
  await assert.rejects(comprarAssinaturaGoogle({ ...pedido, tokenDaConta: null }, iap), (e: any) => e instanceof ErroCompraLoja && e.codigo === "SEM_TOKEN_DA_CONTA");
  assert.equal(chamadas.length, 0);
});

test("plano base ausente no produto, ou sem plano base no catálogo: PRODUTO_INDISPONIVEL, sem compra", async () => {
  const a = lojaFalsa();
  await assert.rejects(comprarAssinaturaGoogle({ ...pedido, planoBase: "semestral" }, a.iap), (e: any) => e.codigo === "PRODUTO_INDISPONIVEL");
  assert.equal(a.pedidos().length, 0);
  const b = lojaFalsa();
  await assert.rejects(comprarAssinaturaGoogle({ ...pedido, planoBase: null }, b.iap), (e: any) => e.codigo === "PRODUTO_INDISPONIVEL");
  assert.equal(b.pedidos().length, 0);
});

test("sem o módulo nativo (Expo Go): IAP_INDISPONIVEL", async () => {
  await assert.rejects(comprarAssinaturaGoogle(pedido, null), (e: any) => e.codigo === "IAP_INDISPONIVEL");
  await assert.rejects(comprasParaRestaurarGoogle(null), (e: any) => e.codigo === "IAP_INDISPONIVEL");
});

test("usuário cancelou na folha da Google Play: COMPRA_CANCELADA; outro erro sobe como veio", async () => {
  const { iap } = lojaFalsa({ erro: { code: "user-cancelled", message: "cancelado" } });
  await assert.rejects(comprarAssinaturaGoogle(pedido, iap), (e: any) => e instanceof ErroCompraLoja && e.codigo === "COMPRA_CANCELADA");
  const outro = { code: "service-error", message: "falhou" };
  await assert.rejects(comprarAssinaturaGoogle(pedido, lojaFalsa({ erro: outro }).iap), (e: any) => e === outro);
});

test("pagamento pendente volta marcado como pendente", async () => {
  const { iap } = lojaFalsa({ compras: [{ productId: PRODUTO, purchaseToken: "comprovante-p", purchaseState: "pending" }] });
  const compra = await comprarAssinaturaGoogle(pedido, iap);
  assert.equal(compra.pendente, true);
});

test("retorno void não encerra compra; evento de outro produto é ignorado e listeners são removidos", async () => {
  const { iap, chamadas } = lojaFalsa({ compras: [
    { productId: "outro.produto", purchaseToken: "x", purchaseState: "purchased" },
    { productId: PRODUTO, purchaseToken: "correto", purchaseState: "purchased" },
  ] });
  const compra = await comprarAssinaturaGoogle(pedido, iap);
  assert.equal(compra.comprovante, "correto");
  assert.equal(chamadas.filter((c) => c.nome.startsWith("remove")).length, 2);
});

test("compra já possuída é recuperada antes de abrir a folha ou consultar produtos", async () => {
  const { iap, chamadas } = lojaFalsa({ disponiveis: [
    { productId: PRODUTO, purchaseToken: "existente", purchaseState: "purchased" },
  ] });
  assert.equal((await comprarAssinaturaGoogle(pedido, iap)).comprovante, "existente");
  assert.equal(chamadas.some((c) => c.nome === "requestPurchase" || c.nome === "fetchProducts" || c.nome === "finishTransaction"), false);
});

test("compra pendente anterior não inicia nova cobrança", async () => {
  const { iap, chamadas } = lojaFalsa({ disponiveis: [
    { productId: PRODUTO, purchaseState: "pending" },
  ] });
  assert.equal((await comprarAssinaturaGoogle(pedido, iap)).pendente, true);
  assert.equal(chamadas.some((c) => c.nome === "requestPurchase"), false);
});

test("sem evento a tempo devolve confirmação pendente e remove listeners", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { iap, chamadas } = lojaFalsa({ compras: [] });
  const compra = comprarAssinaturaGoogle(pedido, iap);
  const rejeicao = assert.rejects(compra, (e: any) => e.codigo === "COMPRA_EM_CONFIRMACAO");
  // Conexão, preflight e catálogo terminam antes do relógio da compra.
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
  t.mock.timers.tick(120_000);
  await rejeicao;
  assert.equal(chamadas.filter((c) => c.nome.startsWith("remove")).length, 2);
  assert.equal(chamadas.some((c) => c.nome === "finishTransaction"), false);
});

test("já possuído recupera somente compra paga do produto pedido, sem reconhecer antes do servidor", async () => {
  const { iap, chamadas } = lojaFalsa({ erro: { code: "already-owned" }, disponiveis: [
    { productId: "outro", purchaseToken: "outro", purchaseState: "purchased" },
    { productId: PRODUTO, purchaseToken: "existente", purchaseState: "purchased" },
  ] });
  assert.equal((await comprarAssinaturaGoogle(pedido, iap)).comprovante, "existente");
  assert.equal(chamadas.some((c) => c.nome === "finishTransaction"), false);
});

test("já possuído sem comprovante pago correspondente não concede plano nem usa token de outro produto", async () => {
  const { iap } = lojaFalsa({ erro: { code: "already-owned" }, disponiveis: [
    { productId: "outro", purchaseToken: "x", purchaseState: "purchased" },
    { productId: PRODUTO, purchaseToken: "pendente", purchaseState: "pending" },
  ] });
  await assert.rejects(comprarAssinaturaGoogle(pedido, iap), (e: any) => e.codigo === "COMPRA_JA_EXISTENTE");
});

test("restaurar: só compras pagas e com comprovante", async () => {
  const { iap } = lojaFalsa({
    disponiveis: [
      { productId: PRODUTO, purchaseToken: "paga", purchaseState: "purchased" },
      { productId: PRODUTO, purchaseToken: "pendente", purchaseState: "pending" },
      { productId: PRODUTO, purchaseToken: null, purchaseState: "purchased" },
    ],
  });
  const compras = await comprasParaRestaurarGoogle(iap);
  assert.deepEqual(compras.map((c) => c.comprovante), ["paga"]);
});

test("concluir: reconhecimento de assinatura (não consumível)", async () => {
  const { iap, chamadas } = lojaFalsa();
  const compra = await comprarAssinaturaGoogle(pedido, iap);
  await concluirCompraGoogle(compra, iap);
  const fim = chamadas.find((c) => c.nome === "finishTransaction");
  assert.equal(fim?.args.isConsumable, false);
  assert.equal(fim?.args.purchase.purchaseToken, "comprovante-1");
});

// O fluxo em compraDePlano usa react-native (não roda no node): a ordem é
// conferida no fonte, sem comentários.
const FLUXO = readFileSync(join(import.meta.dirname, "..", "src", "lib", "compraDePlano.ts"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\/\/[^\n]*/g, " ")
  .replace(/\s+/g, " ");

test("fluxo: pendente não vai ao servidor nem é concluído; conclusão só depois da resposta concedida", () => {
  const comprar = FLUXO.slice(FLUXO.indexOf("export async function comprarPlano"), FLUXO.indexOf("export type ResultadoRestauracao"));
  const pendente = comprar.indexOf("if (compra.pendente) return");
  assert.ok(pendente >= 0 && pendente < comprar.indexOf("apresentarCompraGoogle(compra)"), "pendente sai antes do servidor");
  const apresentar = FLUXO.slice(FLUXO.indexOf("async function apresentarCompraGoogle"), FLUXO.indexOf("export async function comprarPlano"));
  const post = apresentar.indexOf('api.post');
  const devolvePendente = apresentar.indexOf("return { pendente: true }");
  const concluir = apresentar.indexOf("concluirCompraGoogle(compra)");
  assert.ok(post >= 0 && devolvePendente > post && concluir > devolvePendente, "concluir só depois do 200");
});

test("fluxo: a compra leva o token da conta vindo do servidor", () => {
  assert.match(FLUXO, /tokenDaConta: caminho\?\.tokenLoja/);
});

// Executa o coordenador real com os adaptadores nativos/HTTP substituídos.
// O React Native não roda no Node; transpilar não altera as decisões do fluxo.
async function fluxoComAdaptadores(opcoes: { status?: number; erro?: unknown; pendente?: boolean; restaurar?: boolean } = {}) {
  const { transpileModule, ModuleKind, ScriptTarget } = await import("typescript");
  const chamadas: string[] = [];
  const compra = { produtoId: PRODUTO, comprovante: "token", pendente: opcoes.pendente ?? false, original: {} };
  const codigo = transpileModule(readFileSync(join(import.meta.dirname, "..", "src", "lib", "compraDePlano.ts"), "utf8"), {
    compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
  }).outputText;
  const adapters: Record<string, unknown> = {
    "react-native": { Platform: { OS: "android" }, Linking: { openURL: async () => {} } },
    "@/components/ui/assinaturaPlano": { podeFazerUpgradeGoogle: () => false },
    "@/lib/api": { api: { get: async () => ({ data: { plan: "FREE", subscription: null } }), post: async () => {
      chamadas.push("servidor");
      if (opcoes.erro) throw opcoes.erro;
      return { status: opcoes.status ?? 200, data: { plan: "PREMIUM" } };
    } } },
    "@/lib/lojaGoogle": {
      ErroCompraLoja,
      comprarAssinaturaGoogle: async () => { chamadas.push("comprar"); return compra; },
      comprasParaRestaurarGoogle: async () => [compra],
      concluirCompraGoogle: async () => { chamadas.push("concluir"); },
    },
  };
  const modulo = { exports: {} as any };
  new Function("require", "module", "exports", codigo)((name: string) => {
    if (!(name in adapters)) throw new Error(`Adaptador inesperado: ${name}`);
    return adapters[name];
  }, modulo, modulo.exports);
  const caminho = { stripe: false, loja: { android: true, ios: false }, tokenLoja: TOKEN_CONTA };
  return { chamadas, executar: () => opcoes.restaurar
    ? modulo.exports.restaurarCompras(caminho)
    : modulo.exports.comprarPlano({ id: "pro_mensal", storeProductId: PRODUTO, storeBasePlanId: "mensal" }, caminho) };
}

test("coordenador real: confirma no servidor antes de concluir a compra e devolver sucesso", async () => {
  const fluxo = await fluxoComAdaptadores();
  assert.deepEqual(await fluxo.executar(), { via: "loja", plano: "PREMIUM" });
  assert.deepEqual(fluxo.chamadas, ["comprar", "servidor", "concluir"]);
});

test("coordenador real: pendência local ou HTTP202 nunca conclui compra nem anuncia sucesso", async () => {
  for (const opcoes of [{ pendente: true }, { status: 202 }]) {
    const fluxo = await fluxoComAdaptadores(opcoes);
    assert.deepEqual(await fluxo.executar(), { via: "loja", pendente: true });
    assert.deepEqual(fluxo.chamadas, opcoes.pendente ? ["comprar"] : ["comprar", "servidor"]);
  }
});

test("coordenador real: erro de validação não reconhece transação nem devolve sucesso", async () => {
  const erro = { response: { status: 403 } };
  const fluxo = await fluxoComAdaptadores({ erro });
  await assert.rejects(fluxo.executar(), (e) => e === erro);
  assert.deepEqual(fluxo.chamadas, ["comprar", "servidor"]);
});

test("restauração real: distingue recusa da conta e indisponibilidade transitória", async () => {
  for (const status of [403, 503]) {
    const fluxo = await fluxoComAdaptadores({ restaurar: true, erro: { response: { status } } });
    assert.deepEqual(await fluxo.executar(), { restauradas: 0, recusadas: status === 403 ? 1 : 0, pendentes: 0, falhas: status === 503 ? 1 : 0, plano: null });
    assert.deepEqual(fluxo.chamadas, ["servidor"]);
  }
});
