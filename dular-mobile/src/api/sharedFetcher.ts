/**
 * Dedupe global de requests caros que são chamados por múltiplas telas
 * montadas simultaneamente no bottom tab navigator.
 *
 * Sem isso, /api/servicos/minhas (9+ callers) e /api/usuarios/[id]/score
 * (vários callers) disparam requests paralelas que saturam o backend
 * (ngrok+Railway) — TIMEOUTs em cascata visíveis nos logs do QA.
 *
 * Comportamento:
 * - 1ª chamada: dispara request, todas as outras esperam a mesma Promise
 * - Cache válido por `staleMs`: retorna imediato sem fazer request
 * - `force=true`: ignora cache (pull-to-refresh)
 *
 * Drop-in replacement: cada caller usa a função em vez de api.get direto.
 */

import { api } from "@/lib/api";

// ─── /api/servicos/minhas ──────────────────────────────────────────────────

const SERVICOS_STALE_MS = 12000;
let servicosCached: any = null;
let servicosCachedAt = 0;
let servicosPending: Promise<any> | null = null;

export async function fetchServicosMinhas(force = false): Promise<any> {
  if (servicosPending) return servicosPending;
  if (!force && servicosCached && Date.now() - servicosCachedAt < SERVICOS_STALE_MS) {
    return servicosCached;
  }

  servicosPending = (async () => {
    try {
      const res = await api.get("/api/servicos/minhas");
      servicosCached = res.data;
      servicosCachedAt = Date.now();
      return res.data;
    } finally {
      servicosPending = null;
    }
  })();

  return servicosPending;
}

export function invalidateServicosMinhas() {
  servicosCached = null;
  servicosCachedAt = 0;
}

// ─── /api/usuarios/[userId]/score ──────────────────────────────────────────

const SCORE_STALE_MS = 30000; // score muda raramente
const scoreCache = new Map<string, { data: any; at: number }>();
const scorePending = new Map<string, Promise<any>>();

export async function fetchUserScore(userId: string, force = false): Promise<any> {
  if (!userId) return null;
  const existingPromise = scorePending.get(userId);
  if (existingPromise) return existingPromise;

  const cached = scoreCache.get(userId);
  if (!force && cached && Date.now() - cached.at < SCORE_STALE_MS) {
    return cached.data;
  }

  const promise = (async () => {
    try {
      const res = await api.get(`/api/usuarios/${userId}/score`);
      scoreCache.set(userId, { data: res.data, at: Date.now() });
      return res.data;
    } finally {
      scorePending.delete(userId);
    }
  })();

  scorePending.set(userId, promise);
  return promise;
}
