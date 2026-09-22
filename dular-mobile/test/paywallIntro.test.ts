import assert from "node:assert/strict";
import test from "node:test";
import {
  MotivoPaywall,
  deveExibirIntro,
  paramsDeLimiteExcedido,
  podeConsultarIntro,
} from "../src/lib/paywall";

/**
 * Regras do cliente para a apresentação do Premium.
 *
 * A decisão final é do backend (POST /api/me/subscription/claim-intro); o que
 * se trava aqui é o que o app faz com a resposta e quando ele chega a
 * perguntar. O defeito de origem era um `let` de módulo: estado do processo,
 * não da conta.
 */

test("não pergunta antes de a sessão estar autenticada", () => {
  // Durante o bootstrap não há conta apta: perguntar aqui reivindicaria a
  // apresentação de alguém que ainda nem terminou de abrir o app.
  assert.equal(
    podeConsultarIntro({ autenticado: false, userId: "u-1", jaConsultadas: new Set() }),
    false,
  );
  assert.equal(
    podeConsultarIntro({ autenticado: true, userId: null, jaConsultadas: new Set() }),
    false,
  );
  assert.equal(
    podeConsultarIntro({ autenticado: true, userId: undefined, jaConsultadas: new Set() }),
    false,
  );
});

test("pergunta uma vez por conta e não a cada volta para a Home", () => {
  const jaConsultadas = new Set<string>();
  assert.equal(podeConsultarIntro({ autenticado: true, userId: "u-1", jaConsultadas }), true);

  jaConsultadas.add("u-1");
  assert.equal(podeConsultarIntro({ autenticado: true, userId: "u-1", jaConsultadas }), false);
});

test("trocar de conta sem fechar o app volta a perguntar", () => {
  // Este é o caso que a flag única de módulo errava: ligada pela primeira
  // conta, a segunda nunca era perguntada.
  const jaConsultadas = new Set<string>(["u-1"]);
  assert.equal(podeConsultarIntro({ autenticado: true, userId: "u-2", jaConsultadas }), true);
});

test("só exibe com autorização explícita do backend", () => {
  assert.equal(deveExibirIntro({ shouldShow: true, claimed: true }), true);
  assert.equal(deveExibirIntro({ shouldShow: false, reason: "ALREADY_SHOWN" }), false);
  assert.equal(deveExibirIntro({ shouldShow: false, reason: "ALREADY_SUBSCRIBED" }), false);
});

test("resposta ausente ou inesperada não exibe nada", () => {
  // Erro de rede não chega a produzir corpo: o hook nem chama isto. O que se
  // trava aqui é o resto — corpo vazio, shape trocado, string no lugar do
  // booleano. Tudo falha fechado.
  assert.equal(deveExibirIntro(undefined), false);
  assert.equal(deveExibirIntro(null), false);
  assert.equal(deveExibirIntro({}), false);
  assert.equal(deveExibirIntro({ shouldShow: "true" }), false);
  assert.equal(deveExibirIntro("ok"), false);
});

test("os dois gatilhos do paywall são motivos distintos", () => {
  assert.notEqual(MotivoPaywall.FIRST_LOGIN, MotivoPaywall.FREE_LIMIT_REACHED);
  assert.equal(MotivoPaywall.FIRST_LOGIN, "FIRST_LOGIN");
  assert.equal(MotivoPaywall.FREE_LIMIT_REACHED, "FREE_LIMIT_REACHED");
});

test("E) limite do gratuito esgotado abre o paywall pelo outro motivo", () => {
  // Conta que já viu a apresentação continua recebendo o paywall quando
  // esbarra no limite: os dois gatilhos são independentes, e é o 403 do
  // backend que manda aqui.
  const params = paramsDeLimiteExcedido({
    response: {
      status: 403,
      data: { error: "LIMIT_EXCEEDED", message: "Limite de 5 serviços atingido." },
    },
  });

  assert.equal(params?.motivo, MotivoPaywall.FREE_LIMIT_REACHED);
  assert.equal(params?.mensagem, "Limite de 5 serviços atingido.");
});

test("403 de outra origem não vira oferta de plano", () => {
  // Conta bloqueada também responde 403. Tratar isso como falta de plano
  // ofereceria assinatura a quem não precisa de assinatura nenhuma.
  assert.equal(
    paramsDeLimiteExcedido({
      response: { status: 403, data: { error: "CONTA_BLOQUEADA", message: "Conta bloqueada." } },
    }),
    null,
  );
  assert.equal(paramsDeLimiteExcedido({ response: { status: 500 } }), null);
  assert.equal(paramsDeLimiteExcedido(new Error("rede caiu")), null);
  assert.equal(paramsDeLimiteExcedido(undefined), null);
});
