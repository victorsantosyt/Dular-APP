type Hit = { count: number; resetAt: number };

// Rate limit em memória: protege uma instância do processo Next.js.
// Em serverless/multi-instância, cada instância mantém seu próprio bucket.
// Fase futura deve trocar por storage compartilhado (ex.: Redis) antes de
// depender disso como limite global forte.
const buckets = new Map<string, Hit>();

function now() {
  return Date.now();
}

export function rateLimit(opts: { key: string; limit: number; windowMs: number }) {
  const t = now();
  const hit = buckets.get(opts.key);

  if (!hit || hit.resetAt <= t) {
    buckets.set(opts.key, { count: 1, resetAt: t + opts.windowMs });
    return { ok: true, remaining: opts.limit - 1, resetAt: t + opts.windowMs };
  }

  hit.count += 1;
  buckets.set(opts.key, hit);

  const remaining = Math.max(0, opts.limit - hit.count);
  const ok = hit.count <= opts.limit;

  return { ok, remaining, resetAt: hit.resetAt };
}

// limpeza leve (evita crescer infinito)
export function cleanupRateLimit(maxAgeMs = 10 * 60_000) {
  const t = now();
  for (const [k, v] of buckets.entries()) {
    if (v.resetAt + maxAgeMs < t) buckets.delete(k);
  }
}

export function rateLimitRetryAfterMs(resetAt: number) {
  return Math.max(0, resetAt - Date.now());
}
