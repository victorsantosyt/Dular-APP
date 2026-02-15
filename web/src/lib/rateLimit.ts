type Hit = { count: number; resetAt: number };

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
