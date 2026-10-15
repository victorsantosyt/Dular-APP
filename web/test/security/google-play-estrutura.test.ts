import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { situacaoDoGoogle, ErroDeLoja } from "../../src/lib/lojas";

/**
 * Resposta do Google incompleta: o erro diz QUAIS campos faltam e a estrutura
 * do item (presença e tipo), sem nenhum valor do recurso.
 */

const SEGREDOS = ["tok-secreto", "conta-secreta", "br.com.dular.diarista.pro.mensal", "2026-11-15", "4990000"];

function erroDe(recurso: unknown): ErroDeLoja {
  try {
    situacaoDoGoogle(recurso, "tok-secreto", Date.parse("2026-10-20T00:00:00Z"));
  } catch (e) {
    return e as ErroDeLoja;
  }
  throw new Error("esperava recusa");
}

describe("situacaoDoGoogle: diagnóstico de resposta incompleta", () => {
  it("nomeia o campo ausente e a estrutura, sem valores", () => {
    const e = erroDe({
      subscriptionState: "SUBSCRIPTION_STATE_CANCELED",
      startTime: "2026-10-15T00:00:00Z",
      externalAccountIdentifiers: { obfuscatedExternalAccountId: "conta-secreta" },
      lineItems: [{
        productId: "br.com.dular.diarista.pro.mensal",
        expiryTime: "2026-11-15T00:00:00Z",
        autoRenewingPlan: { recurringPrice: { units: "4990000" } },
      }],
    });
    assert.equal(e.codigo, "LOJA_INDISPONIVEL");
    assert.match(e.message, /falta lineItems\[0\]\.autoRenewingPlan\.autoRenewEnabled/);
    assert.match(e.message, /estado=SUBSCRIPTION_STATE_CANCELED/);
    assert.match(e.message, /autoRenewingPlan=object, autoRenewEnabled=ausente, prepaidPlan=ausente, expiryTime=string/);
    for (const s of SEGREDOS) assert.ok(!e.message.includes(s), `vazou ${s}`);
  });

  it("lista vários campos ausentes", () => {
    const e = erroDe({ subscriptionState: "SUBSCRIPTION_STATE_EXPIRED", lineItems: [{}] });
    assert.match(e.message, /falta startTime, lineItems\[0\]\.expiryTime, lineItems\[0\]\.productId, lineItems\[0\]\.autoRenewingPlan\.autoRenewEnabled/);
    assert.match(e.message, /autoRenewingPlan=ausente/);
  });
});
