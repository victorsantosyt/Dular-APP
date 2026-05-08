import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export interface DiaristaPublico {
  id: string;
  nome: string;
  bio?: string;
  avatarUrl?: string;
  mediaAvaliacao: number;
  totalAvaliacoes: number;
  totalServicos: number;
  tempoPlataforma: number;
  verificado: boolean;
  safeScore: {
    faixa: string;
    totalIncidentes: number;
  };
  servicos: Array<{
    tipo: string;
    precoMedio?: number;
  }>;
}

export interface UseDiaristaPublicoReturn {
  diarista: DiaristaPublico | null;
  loading: boolean;
  error: string | null;
}

interface ScoreResponse {
  score: number;
  faixa: string;
  totalIncidentes: number;
}

interface TrustSignalsResponse {
  verificado: boolean;
  tempoPlataforma: number;
  totalServicos: number;
  mediaAvaliacao: number;
  totalAvaliacoes: number;
  nome?: string;
  bio?: string;
  avatarUrl?: string;
}

export function useDiaristaPublico(diaristaId: string): UseDiaristaPublicoReturn {
  const [diarista, setDiarista] = useState<DiaristaPublico | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!diaristaId) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [scoreRes, trustRes] = await Promise.all([
          api.get<ScoreResponse>(`/api/usuarios/${diaristaId}/score`),
          api.get<TrustSignalsResponse>(`/api/usuarios/${diaristaId}/trust-signals`),
        ]);

        if (cancelled) return;

        const score = scoreRes.data;
        const trust = trustRes.data;

        setDiarista({
          id: diaristaId,
          nome: trust.nome ?? "",
          bio: trust.bio,
          avatarUrl: trust.avatarUrl,
          mediaAvaliacao: trust.mediaAvaliacao ?? 0,
          totalAvaliacoes: trust.totalAvaliacoes ?? 0,
          totalServicos: trust.totalServicos ?? 0,
          tempoPlataforma: trust.tempoPlataforma ?? 0,
          verificado: trust.verificado ?? false,
          safeScore: {
            faixa: score.faixa ?? "—",
            totalIncidentes: score.totalIncidentes ?? 0,
          },
          servicos: [],
        });
      } catch {
        if (!cancelled) {
          setError("Não foi possível carregar o perfil da profissional.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [diaristaId]);

  return { diarista, loading, error };
}
