import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { situacaoDoGoogle, ErroDeLoja } from "../../src/lib/lojas";

/**
 * Resposta do `subscriptionsv2.get` com campos omitidos. A API omite booleanos
 * falsos: com a renovação desligada, `autoRenewEnabled` some de dentro de
 * `autoRenewingPlan` (medido no staging em CANCELED/EXPIRED/revogada/anulada).
 * Renovação ≠ acesso: o acesso segue o estado e o fim do período.
 */

const AGORA = Date.parse("2026-10-20T00:00:00Z");
const FUTURO = "2026-11-15T00:00:00Z";
const PASSADO = "2026-10-10T00:00:00Z";
const SEGREDOS = ["tok-secreto", "conta-secreta", "br.com.dular.diarista.pro.mensal", "2026-11-15", "4990000"];

const recurso = (estado: string, item: Record<string, unknown>) => ({
  subscriptionState: estado,
  startTime: "2026-10-15T00:00:00Z",
  externalAccountIdentifiers: { obfuscatedExternalAccountId: "conta-secreta" },
  lineItems: [{ productId: "br.com.dular.diarista.pro.mensal", ...item }],
});
const semFlag = { autoRenewingPlan: { recurringPrice: { units: "4990000" } } };

function erroDe(r: unknown): ErroDeLoja {
  try {
    situacaoDoGoogle(r, "tok-secreto", AGORA);
  } catch (e) {
    return e as ErroDeLoja;
  }
  throw new Error("esperava recusa");
}

describe("situacaoDoGoogle: autoRenewEnabled omitido", () => {
  it("CANCELED com fim no futuro: renovação desligada, acesso mantido até o fim", () => {
    const s = situacaoDoGoogle(recurso("SUBSCRIPTION_STATE_CANCELED", { expiryTime: FUTURO, ...semFlag }), "tok-secreto", AGORA);
    assert.deepEqual([s.vigente, s.renova, s.final], [true, false, false]);
  });

  it("CANCELED com fim no passado: sem acesso", () => {
    const s = situacaoDoGoogle(recurso("SUBSCRIPTION_STATE_CANCELED", { expiryTime: PASSADO, ...semFlag }), "tok-secreto", AGORA);
    assert.deepEqual([s.vigente, s.renova], [false, false]);
  });

  it("EXPIRED (expiração ou revogação, mesmo com fim no futuro): sem acesso e encerrada de vez", () => {
    for (const fim of [PASSADO, FUTURO]) {
      const s = situacaoDoGoogle(recurso("SUBSCRIPTION_STATE_EXPIRED", { expiryTime: fim, ...semFlag }), "tok-secreto", AGORA);
      assert.deepEqual([s.vigente, s.renova, s.final], [false, false, true], `fim ${fim}`);
    }
  });

  it("ACTIVE com autoRenewEnabled true segue renovando; com o campo omitido, não renova", () => {
    const ligado = situacaoDoGoogle(recurso("SUBSCRIPTION_STATE_ACTIVE", { expiryTime: FUTURO, autoRenewingPlan: { autoRenewEnabled: true } }), "tok-secreto", AGORA);
    assert.deepEqual([ligado.vigente, ligado.renova], [true, true]);
    const omitido = situacaoDoGoogle(recurso("SUBSCRIPTION_STATE_ACTIVE", { expiryTime: FUTURO, ...semFlag }), "tok-secreto", AGORA);
    assert.deepEqual([omitido.vigente, omitido.renova], [true, false]);
  });

  it("pré-pago (prepaidPlan): não renova; acesso pelo estado e fim", () => {
    const s = situacaoDoGoogle(recurso("SUBSCRIPTION_STATE_ACTIVE", { expiryTime: FUTURO, prepaidPlan: {} }), "tok-secreto", AGORA);
    assert.deepEqual([s.vigente, s.renova], [true, false]);
  });

  it("autoRenewEnabled com tipo errado: recusa", () => {
    const e = erroDe(recurso("SUBSCRIPTION_STATE_ACTIVE", { expiryTime: FUTURO, autoRenewingPlan: { autoRenewEnabled: "true" } }));
    assert.equal(e.codigo, "LOJA_INDISPONIVEL");
  });
});

describe("situacaoDoGoogle: diagnóstico de resposta incompleta", () => {
  it("sem plano nenhum: recusa nomeando o campo e a estrutura, sem valores", () => {
    const e = erroDe(recurso("SUBSCRIPTION_STATE_ACTIVE", { expiryTime: FUTURO }));
    assert.equal(e.codigo, "LOJA_INDISPONIVEL");
    assert.match(e.message, /falta lineItems\[0\]\.autoRenewingPlan\|prepaidPlan/);
    assert.match(e.message, /estado=SUBSCRIPTION_STATE_ACTIVE/);
    assert.match(e.message, /autoRenewingPlan=ausente, autoRenewEnabled=ausente, prepaidPlan=ausente, expiryTime=string/);
    for (const s of SEGREDOS) assert.ok(!e.message.includes(s), `vazou ${s}`);
  });

  it("lista vários campos ausentes", () => {
    const e = erroDe({ subscriptionState: "SUBSCRIPTION_STATE_EXPIRED", lineItems: [{}] });
    assert.match(e.message, /falta startTime, lineItems\[0\]\.expiryTime, lineItems\[0\]\.productId, lineItems\[0\]\.autoRenewingPlan\|prepaidPlan/);
  });
});
