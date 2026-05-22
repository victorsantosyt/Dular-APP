import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  rateLimit,
  rateLimitRetryAfterMs,
  cleanupRateLimit,
} from "../../src/lib/rateLimit";

// Cada teste usa um prefixo de chave único para não vazar bucket entre testes.
// Buckets são em memória do processo (documentado em rateLimit.ts).
function uniqueKey(label: string) {
  return `test:${label}:${Math.random().toString(36).slice(2)}:${Date.now()}`;
}

describe("rateLimit", () => {
  it("permite chamadas dentro do limite", () => {
    const key = uniqueKey("ok");
    for (let i = 0; i < 5; i++) {
      const r = rateLimit({ key, limit: 5, windowMs: 60_000 });
      assert.equal(r.ok, true, `chamada ${i + 1} deveria passar`);
    }
  });

  it("bloqueia ao exceder o limite", () => {
    const key = uniqueKey("block");
    for (let i = 0; i < 3; i++) {
      rateLimit({ key, limit: 3, windowMs: 60_000 });
    }
    const blocked = rateLimit({ key, limit: 3, windowMs: 60_000 });
    assert.equal(blocked.ok, false);
  });

  it("retorna remaining decrescente até zero", () => {
    const key = uniqueKey("remaining");
    const a = rateLimit({ key, limit: 3, windowMs: 60_000 });
    const b = rateLimit({ key, limit: 3, windowMs: 60_000 });
    const c = rateLimit({ key, limit: 3, windowMs: 60_000 });
    assert.equal(a.remaining, 2);
    assert.equal(b.remaining, 1);
    assert.equal(c.remaining, 0);
  });

  it("retorna resetAt no futuro", () => {
    const key = uniqueKey("reset");
    const before = Date.now();
    const r = rateLimit({ key, limit: 1, windowMs: 60_000 });
    assert.ok(r.resetAt >= before + 60_000 - 100);
    assert.ok(r.resetAt <= before + 60_000 + 100);
  });

  it("libera após janela expirar (windowMs curto)", async () => {
    const key = uniqueKey("window");
    rateLimit({ key, limit: 1, windowMs: 30 });
    const blocked = rateLimit({ key, limit: 1, windowMs: 30 });
    assert.equal(blocked.ok, false);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const afterWindow = rateLimit({ key, limit: 1, windowMs: 30 });
    assert.equal(afterWindow.ok, true);
  });

  it("chaves diferentes têm buckets independentes", () => {
    const k1 = uniqueKey("a");
    const k2 = uniqueKey("b");
    rateLimit({ key: k1, limit: 1, windowMs: 60_000 });
    rateLimit({ key: k1, limit: 1, windowMs: 60_000 }); // bloqueia k1
    const r2 = rateLimit({ key: k2, limit: 1, windowMs: 60_000 });
    assert.equal(r2.ok, true);
  });
});

describe("rateLimitRetryAfterMs", () => {
  it("retorna número positivo quando resetAt está no futuro", () => {
    const ms = rateLimitRetryAfterMs(Date.now() + 5_000);
    assert.ok(ms > 0);
    assert.ok(ms <= 5_000);
  });

  it("retorna 0 (nunca negativo) quando resetAt já passou", () => {
    const ms = rateLimitRetryAfterMs(Date.now() - 10_000);
    assert.equal(ms, 0);
  });

  it("retorna 0 quando resetAt = 0", () => {
    const ms = rateLimitRetryAfterMs(0);
    assert.equal(ms, 0);
  });

  it("nunca retorna NaN", () => {
    const ms = rateLimitRetryAfterMs(Date.now() + 1_000);
    assert.ok(!Number.isNaN(ms));
  });
});

describe("cleanupRateLimit", () => {
  it("não lança", () => {
    assert.doesNotThrow(() => cleanupRateLimit());
  });

  it("aceita maxAgeMs custom", () => {
    assert.doesNotThrow(() => cleanupRateLimit(1000));
  });
});
