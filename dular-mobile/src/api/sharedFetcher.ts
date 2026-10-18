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
 * Isolamento: cada entrada (e cada request em voo) guarda a MARCA de quando
 * foi pedida — a época da sessão (lib/sessaoAtual) e, para serviços, a revisão
 * de "servicos" da sincronização. Marca diferente = não serve e não grava:
 * resposta da conta anterior, ou de antes de sair e entrar de novo, nunca
 * aparece; e mudança confirmada pelo backend faz a próxima leitura buscar de novo.
 *
 * Drop-in replacement: cada caller usa a função em vez de api.get direto.
 */

import { api } from "@/lib/api";
import { epocaSessao } from "@/lib/sessaoAtual";
import { useSincronizacao } from "@/lib/sincronizacaoConta";

export class SessaoTrocadaError extends Error {
  constructor() {
    super("A sessão mudou durante a consulta.");
    this.name = "SessaoTrocadaError";
  }
}

// ─── /api/servicos/minhas ──────────────────────────────────────────────────

const SERVICOS_STALE_MS = 12000;
const marcaServicos = () => `${epocaSessao()}:${useSincronizacao.getState().revisoes.servicos}`;
let servicosCached: { data: any; at: number; marca: string } | null = null;
let servicosPending: { promise: Promise<any>; marca: string } | null = null;

export async function fetchServicosMinhas(force = false): Promise<any> {
  const marca = marcaServicos();
  if (servicosPending?.marca === marca) return servicosPending.promise;
  if (!force && servicosCached?.marca === marca && Date.now() - servicosCached.at < SERVICOS_STALE_MS) {
    return servicosCached.data;
  }

  const epoca = epocaSessao();
  const pendente = { marca } as { promise: Promise<any>; marca: string };
  pendente.promise = (async () => {
    try {
      const res = await api.get("/api/servicos/minhas");
      if (epocaSessao() !== epoca) throw new SessaoTrocadaError();
      // Revisão mudou no meio: devolve a quem pediu, mas não guarda.
      if (marcaServicos() === marca) servicosCached = { data: res.data, at: Date.now(), marca };
      return res.data;
    } finally {
      if (servicosPending === pendente) servicosPending = null;
    }
  })();
  servicosPending = pendente;
  return pendente.promise;
}

export function invalidateServicosMinhas() {
  servicosCached = null;
}

// ─── /api/usuarios/[userId]/score ──────────────────────────────────────────

const SCORE_STALE_MS = 30000; // score muda raramente
const scoreCache = new Map<string, { data: any; at: number; epoca: number }>();
const scorePending = new Map<string, { promise: Promise<any>; epoca: number }>();

export async function fetchUserScore(userId: string, force = false): Promise<any> {
  if (!userId) return null;
  const epoca = epocaSessao();
  const existing = scorePending.get(userId);
  if (existing?.epoca === epoca) return existing.promise;

  const cached = scoreCache.get(userId);
  if (!force && cached?.epoca === epoca && Date.now() - cached.at < SCORE_STALE_MS) {
    return cached.data;
  }

  const pendente = { epoca } as { promise: Promise<any>; epoca: number };
  pendente.promise = (async () => {
    try {
      const res = await api.get(`/api/usuarios/${userId}/score`);
      if (epocaSessao() !== epoca) throw new SessaoTrocadaError();
      scoreCache.set(userId, { data: res.data, at: Date.now(), epoca });
      return res.data;
    } finally {
      if (scorePending.get(userId) === pendente) scorePending.delete(userId);
    }
  })();

  scorePending.set(userId, pendente);
  return pendente.promise;
}

/** Logout: nada desta sessão fica guardado (a época já impede o uso; isto libera a memória). */
export function limparCachesCompartilhados(): void {
  servicosCached = null;
  servicosPending = null;
  scoreCache.clear();
  scorePending.clear();
}
