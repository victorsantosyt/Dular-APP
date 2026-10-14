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
  const registrar = (nome: string) => async (args?: any) => {
    chamadas.push({ nome, args });
  };
  const iap = {
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
      if (opcoes.erro) throw opcoes.erro;
      return opcoes.compras ?? [{ productId: PRODUTO, purchaseToken: "comprovante-1", purchaseState: "purchased" }];
    },
    getAvailablePurchases: async () => {
      chamadas.push({ nome: "getAvailablePurchases", args: null });
      return opcoes.disponiveis ?? [];
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

test("a loja não devolveu a compra deste produto: COMPRA_NAO_CONCLUIDA", async () => {
  const { iap } = lojaFalsa({ compras: [{ productId: "outro.produto", purchaseToken: "x", purchaseState: "purchased" }] });
  await assert.rejects(comprarAssinaturaGoogle(pedido, iap), (e: any) => e.codigo === "COMPRA_NAO_CONCLUIDA");
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
