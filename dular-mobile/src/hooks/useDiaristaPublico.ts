import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ServicoOferecido } from "@/types/diarista";
import { calcularCompletudeDiarista } from "@/api/diaristaApi";

export interface DiaristaPublicoBairro {
  nome: string;
  cidade: string;
  uf: string;
}

export interface DiaristaPublicoPrecos {
  leve: number | null;
  medio: number | null;
  pesada: number | null;
}

export interface DiaristaPublico {
  id: string;
  userId: string;
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
  servicosOferecidos: ServicoOferecido[];
  bairros: DiaristaPublicoBairro[];
  cidade: string | null;
  uf: string | null;
  precos: DiaristaPublicoPrecos;
  // T-15: novos campos
  atendeTodaCidade: boolean;
  raioAtendimentoKm: number | null;
  anosExperiencia: number | null;
  precoBabaHora: string | number | null;
  precoCozinheiraBase: string | number | null;
  taxaMinima: string | number | null;
  cobraDeslocamento: boolean;
  valorACombinar: boolean;
  observacaoPreco: string | null;
  /** Perfil completo (todos os campos mínimos preenchidos) */
  perfilCompleto: boolean;
  motivos: string[];
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

interface DiaristaPerfilResponse {
  ok: boolean;
  diarista?: {
    id: string;
    userId: string;
    nome: string;
    avatarUrl: string | null;
    bio: string | null;
    verificacao: string;
    servicosOferecidos: ServicoOferecido[];
    bairros: DiaristaPublicoBairro[];
    cidade?: string | null;
    estado?: string | null;
    precos: { leve: number; medio: number; pesada: number };
    notaMedia: number;
    totalServicos: number;
    safeScore: { score: number; tier: string } | null;
    // T-15: novos campos (podem vir conforme endpoint evolui)
    atendeTodaCidade?: boolean;
    raioAtendimentoKm?: number | null;
    anosExperiencia?: number | null;
    precoBabaHora?: string | number | null;
    precoCozinheiraBase?: string | number | null;
    taxaMinima?: string | number | null;
    cobraDeslocamento?: boolean;
    valorACombinar?: boolean;
    observacaoPreco?: string | null;
  };
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
        const [scoreRes, trustRes, perfilRes] = await Promise.all([
          api.get<ScoreResponse>(`/api/usuarios/${diaristaId}/score`),
          api.get<TrustSignalsResponse>(`/api/usuarios/${diaristaId}/trust-signals`),
          api
            .get<DiaristaPerfilResponse>(`/api/diaristas/${diaristaId}`)
            .catch(() => ({ data: { ok: false } } as { data: DiaristaPerfilResponse })),
        ]);

        if (cancelled) return;

        const score = scoreRes.data;
        const trust = trustRes.data;
        const perfil = perfilRes.data?.diarista;

        const bairros = perfil?.bairros ?? [];
        // T-15: cidade/estado podem vir diretos do perfil, com fallback no primeiro bairro
        const cidade = perfil?.cidade ?? bairros[0]?.cidade ?? null;
        const uf = perfil?.estado ?? bairros[0]?.uf ?? null;

        const servicosOferecidos = (perfil?.servicosOferecidos ?? []) as ServicoOferecido[];
        const bio = perfil?.bio ?? trust.bio ?? "";
        const nome = perfil?.nome ?? trust.nome ?? "";

        const atendeTodaCidade = perfil?.atendeTodaCidade ?? false;
        const raioAtendimentoKm = perfil?.raioAtendimentoKm ?? null;
        const valorACombinar = perfil?.valorACombinar ?? false;

        // Reaproveita a heurística de completude do client.
        const completude = calcularCompletudeDiarista(
          perfil
            ? {
                id: perfil.id,
                userId: perfil.userId,
                verificacao: perfil.verificacao as "PENDENTE" | "VERIFICADO" | "REPROVADO",
                ativo: true,
                fotoUrl: perfil.avatarUrl,
                docUrl: null,
                bio: perfil.bio ?? null,
                precoLeve: perfil.precos?.leve ?? null,
                precoMedio: perfil.precos?.medio ?? null,
                precoPesada: perfil.precos?.pesada ?? null,
                notaMedia: perfil.notaMedia,
                totalServicos: perfil.totalServicos,
                servicosOferecidos,
                bairros: bairros.map((b, idx) => ({
                  id: String(idx),
                  bairroId: String(idx),
                  bairro: { id: String(idx), nome: b.nome, cidade: b.cidade, uf: b.uf },
                })),
                agenda: [],
                user: { id: perfil.userId, nome: perfil.nome, telefone: "" },
                cidade,
                estado: uf,
                atendeTodaCidade,
                raioAtendimentoKm,
                anosExperiencia: perfil.anosExperiencia ?? null,
                precoBabaHora: perfil.precoBabaHora ?? null,
                precoCozinheiraBase: perfil.precoCozinheiraBase ?? null,
                taxaMinima: perfil.taxaMinima ?? null,
                cobraDeslocamento: perfil.cobraDeslocamento ?? false,
                valorACombinar,
                observacaoPreco: perfil.observacaoPreco ?? null,
              }
            : null,
          nome,
        );

        setDiarista({
          id: diaristaId,
          userId: perfil?.userId ?? diaristaId,
          nome,
          bio,
          avatarUrl: perfil?.avatarUrl ?? trust.avatarUrl ?? undefined,
          mediaAvaliacao: trust.mediaAvaliacao ?? 0,
          totalAvaliacoes: trust.totalAvaliacoes ?? 0,
          totalServicos: perfil?.totalServicos ?? trust.totalServicos ?? 0,
          tempoPlataforma: trust.tempoPlataforma ?? 0,
          verificado: trust.verificado ?? false,
          safeScore: {
            faixa: score.faixa ?? "—",
            totalIncidentes: score.totalIncidentes ?? 0,
          },
          servicos: [],
          servicosOferecidos,
          bairros,
          cidade,
          uf,
          precos: {
            leve: perfil?.precos?.leve ?? null,
            medio: perfil?.precos?.medio ?? null,
            pesada: perfil?.precos?.pesada ?? null,
          },
          atendeTodaCidade,
          raioAtendimentoKm,
          anosExperiencia: perfil?.anosExperiencia ?? null,
          precoBabaHora: perfil?.precoBabaHora ?? null,
          precoCozinheiraBase: perfil?.precoCozinheiraBase ?? null,
          taxaMinima: perfil?.taxaMinima ?? null,
          cobraDeslocamento: perfil?.cobraDeslocamento ?? false,
          valorACombinar,
          observacaoPreco: perfil?.observacaoPreco ?? null,
          perfilCompleto: completude.completo,
          motivos: completude.motivos,
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
