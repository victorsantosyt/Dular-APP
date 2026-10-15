import assert from "node:assert/strict";
import test from "node:test";
import { apresentacaoDoPlano, planoAtualDoCatalogo, bloqueiaNovaCompra, exibicaoDosPlanos, alternativasDoPlano, gerenciaAssinaturaNaGoogle, podeFazerUpgradeGoogle, estadoDoPlano, type AssinaturaPlano } from "../src/components/ui/assinaturaPlano";

function assinatura(plan: string, interval: "month" | "year" | null, id: string | null = "montador_pro_mensal"): AssinaturaPlano {
  return { plan, subscription: { plan, interval, planId: id, name: null, status: "ACTIVE", provider: "GOOGLE_PLAY", storeProductId: null, expiresAt: null, canceledAt: null } };
}

test("sem resposta não afirma plano gratuito nem assinatura atual", () => {
  assert.equal(apresentacaoDoPlano(null), null);
  assert.equal(planoAtualDoCatalogo(null, "montador_pro_mensal"), false);
});

test("assinante abre resumo; somente Upgrade abre catálogo; gratuito vê catálogo", () => {
  const data = assinatura("PREMIUM", "month");
  assert.equal(exibicaoDosPlanos(null, false), "consulta");
  assert.equal(exibicaoDosPlanos(null, true), "consulta");
  assert.equal(exibicaoDosPlanos(data, false), "resumo");
  assert.equal(exibicaoDosPlanos(data, true), "catalogo");
  assert.equal(exibicaoDosPlanos(assinatura("FREE", null), false), "catalogo");
  assert.equal(exibicaoDosPlanos(assinatura("FREE", null), true), "catalogo");
});

test("Upgrade exclui apenas o id atual confirmado; expirado volta a ter todas as opções", () => {
  const planos = [{ id: "montador_basico_mensal" }, { id: "montador_pro_mensal" }, { id: "montador_pro_anual" }];
  assert.deepEqual(alternativasDoPlano(assinatura("PREMIUM", "month"), planos).map(p => p.id), ["montador_basico_mensal", "montador_pro_anual"]);
  assert.deepEqual(alternativasDoPlano(assinatura("FREE", "month"), planos), planos);
  assert.deepEqual(alternativasDoPlano(assinatura("PREMIUM", null, null), planos), planos);
  assert.deepEqual(alternativasDoPlano(assinatura("PREMIUM", "month", "pro_mensal"), planos), planos);
});

test("gerenciamento Google reconhece provider do backend sem oferecer compra duplicada", () => {
  const data = assinatura("PREMIUM", "month");
  data.subscription!.provider = "GOOGLE";
  assert.equal(gerenciaAssinaturaNaGoogle(data), true);
  assert.equal(bloqueiaNovaCompra(data, "montador_pro_anual", true), true);
  data.subscription!.provider = "STRIPE";
  assert.equal(gerenciaAssinaturaNaGoogle(data), false);
  assert.equal(gerenciaAssinaturaNaGoogle(assinatura("FREE", "month")), false);
  assert.equal(gerenciaAssinaturaNaGoogle(null), false);
});

test("estado pendente ou desconhecido não anuncia assinatura ativa", () => {
  const data = assinatura("PREMIUM", "month");
  assert.equal(estadoDoPlano(data), "Assinatura ativa");
  data.subscription!.status = "PAST_DUE";
  assert.match(estadoDoPlano(data), /Pagamento pendente/);
  data.subscription!.status = "UNKNOWN";
  assert.doesNotMatch(estadoDoPlano(data), /ativa/);
  data.subscription!.canceledAt = "2026-10-15T00:00:00Z";
  assert.match(estadoDoPlano(data), /Renovação cancelada/);
});

test("upgrade Google permite Básico para Pro e Pro mensal para anual sem downgrade ou repetição", () => {
  const data = assinatura("BASIC", "month", "montador_basico_mensal");
  data.subscription!.provider = "GOOGLE";
  const mensal = { id: "montador_pro_mensal", plan: "PREMIUM", interval: "month" };
  const anual = { id: "montador_pro_anual", plan: "PREMIUM", interval: "year" };
  const basico = { id: "montador_basico_mensal", plan: "BASIC", interval: "month" };
  assert.equal(podeFazerUpgradeGoogle(data, mensal), true);
  assert.equal(podeFazerUpgradeGoogle(data, anual), true);
  assert.equal(podeFazerUpgradeGoogle(data, basico), false);
  data.plan = "PREMIUM";
  data.subscription!.planId = mensal.id;
  assert.equal(podeFazerUpgradeGoogle(data, mensal), false);
  assert.equal(podeFazerUpgradeGoogle(data, anual), true);
  assert.equal(podeFazerUpgradeGoogle(data, basico), false);
  data.subscription!.interval = "year";
  data.subscription!.planId = anual.id;
  assert.equal(podeFazerUpgradeGoogle(data, mensal), false);
  data.subscription!.interval = "month";
  data.subscription!.planId = mensal.id;
  data.subscription!.status = "PAST_DUE";
  assert.equal(podeFazerUpgradeGoogle(data, anual), false);
  data.subscription!.status = "ACTIVE";
  data.subscription!.canceledAt = "2026-10-15T00:00:00Z";
  assert.equal(podeFazerUpgradeGoogle(data, anual), false);
  data.subscription!.canceledAt = null;
  data.subscription!.provider = "STRIPE";
  assert.equal(podeFazerUpgradeGoogle(data, anual), false);
  assert.equal(podeFazerUpgradeGoogle(null, anual), false);
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

