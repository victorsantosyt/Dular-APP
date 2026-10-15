import assert from "node:assert/strict";
import test from "node:test";
import { apresentacaoDoPlano, planoAtualDoCatalogo, bloqueiaNovaCompra, type AssinaturaPlano } from "../src/components/ui/assinaturaPlano";

function assinatura(plan: string, interval: "month" | "year" | null, id: string | null = "montador_pro_mensal"): AssinaturaPlano {
  return { plan, subscription: { plan, interval, planId: id, name: null, status: "ACTIVE", provider: "GOOGLE_PLAY", storeProductId: null, expiresAt: null, canceledAt: null } };
}

test("sem resposta não afirma plano gratuito nem assinatura atual", () => {
  assert.equal(apresentacaoDoPlano(null), null);
  assert.equal(planoAtualDoCatalogo(null, "montador_pro_mensal"), false);
});

test("plano efetivo gratuito prevalece sobre registro expirado", () => {
  const data = assinatura("FREE", "month");
  data.subscription!.plan = "PREMIUM";
  data.subscription!.status = "EXPIRED";
  assert.deepEqual(apresentacaoDoPlano(data), { nome: "Gratuito", icone: "Sprout" });
  assert.equal(planoAtualDoCatalogo(data, "montador_pro_mensal"), false);
});

test("mensal e anual têm ícones distintos e só id confirmado recebe plano atual", () => {
  const mensal = assinatura("PREMIUM", "month");
  assert.equal(apresentacaoDoPlano(mensal)?.icone, "Crown");
  assert.equal(planoAtualDoCatalogo(mensal, "montador_pro_mensal"), true);
  assert.equal(planoAtualDoCatalogo(mensal, "montador_pro_anual"), false);
  const anual = assinatura("PREMIUM", "year", "pro_anual");
  assert.equal(apresentacaoDoPlano(anual)?.icone, "Gem");
  assert.equal(planoAtualDoCatalogo(anual, "pro_anual"), true);
  assert.equal(planoAtualDoCatalogo(anual, "montador_pro_anual"), false);
});

test("básico tem raio; legado sem ciclo não é anunciado como mensal", () => {
  assert.equal(apresentacaoDoPlano(assinatura("BASIC", "month"))?.icone, "Zap");
  assert.deepEqual(apresentacaoDoPlano(assinatura("PREMIUM", null, null)), { nome: "Pro", icone: "Sparkles" });
  assert.equal(planoAtualDoCatalogo(assinatura("PREMIUM", null, null), "pro_mensal"), false);
});

test("cancelamento com acesso vigente mantém identidade; nível desconhecido não inventa plano", () => {
  const data = assinatura("PREMIUM", "year", "montador_pro_anual");
  data.subscription!.canceledAt = "2026-10-14T23:00:00.000Z";
  data.subscription!.name = "Pro Anual";
  assert.deepEqual(apresentacaoDoPlano(data), { nome: "Pro Anual", icone: "Gem" });
  assert.equal(planoAtualDoCatalogo(data, "montador_pro_anual"), true);
  assert.equal(apresentacaoDoPlano(assinatura("DESCONHECIDO", null)), null);
});

test("bloqueia compra duplicada e trocas Google, preserva checkout Stripe de outro plano", () => {
  const google = assinatura("PREMIUM", "month");
  assert.equal(bloqueiaNovaCompra(google, "montador_pro_mensal", true), true);
  assert.equal(bloqueiaNovaCompra(google, "montador_pro_anual", true), true);
  assert.equal(bloqueiaNovaCompra(google, "montador_pro_anual", false), true);
  const stripe = assinatura("BASIC", "month", "montador_basico_mensal");
  stripe.subscription!.provider = "STRIPE";
  assert.equal(bloqueiaNovaCompra(stripe, "montador_pro_mensal", false), false);
  assert.equal(bloqueiaNovaCompra(stripe, "montador_basico_mensal", false), true);
  assert.equal(bloqueiaNovaCompra(stripe, "montador_pro_mensal", true), true);
  assert.equal(bloqueiaNovaCompra(null, "montador_pro_mensal", false), true);
  assert.equal(bloqueiaNovaCompra(assinatura("FREE", null), "montador_pro_mensal", true), false);
});
