import { useState, useCallback } from "react";
import { apiService, type ApiResponse } from "@/services/api";
import { useAuth } from "@/stores/authStore";
import type { BuscarMontadoresResponse, MontadorItem } from "@/types/montador";

export interface ApiDiarista {
  id: string;
  userId: string;
  verificacao: string;
  ativo: boolean;
  fotoUrl?: string | null;
  bio?: string | null;
  precoLeve: number;
  precoPesada: number;
  notaMedia: number;
  totalServicos: number;
  user: {
    id: string;
    nome: string;
    telefone?: string | null;
  };
}

interface BuscarParams {
  cidade: string;
  uf: string;
  bairro?: string;
  tipo?: string;
  categoria?: string;
}

interface BuscarResponse {
  ok: boolean;
  diaristas: ApiDiarista[];
}

export function useBuscar() {
  const { token } = useAuth();
  const [profissionais, setProfissionais] = useState<ApiDiarista[]>([]);
  const [montadores, setMontadores] = useState<MontadorItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diaristasError, setDiaristasError] = useState<string | null>(null);
  const [montadoresError, setMontadoresError] = useState<string | null>(null);

  const getErrorMessage = (err: unknown, fallback: string) => {
    const maybe = err as { response?: { data?: { error?: string; message?: string } }; message?: string };
    return maybe.response?.data?.error ?? maybe.response?.data?.message ?? maybe.message ?? fallback;
  };

  const buscar = useCallback(
    async (params: BuscarParams) => {
      if (!token || !params.cidade || !params.uf) return;
      setLoading(true);
      setError(null);
      setDiaristasError(null);
      setMontadoresError(null);
      try {
        const query = new URLSearchParams({
          cidade: params.cidade,
          uf: params.uf,
        });
        if (params.bairro?.trim()) query.set("bairro", params.bairro.trim());
        if (params.tipo) query.set("tipo", params.tipo);
        if (params.categoria) query.set("categoria", params.categoria);

        const diaristasRequest = params.bairro?.trim()
          ? apiService.get<BuscarResponse>(`/api/diaristas/buscar?${query.toString()}`, token)
          : Promise.resolve<ApiResponse<BuscarResponse>>({ data: { ok: true, diaristas: [] } });

        const [diaristasResult, montadoresResult] = await Promise.allSettled([
          diaristasRequest,
          apiService.get<BuscarMontadoresResponse>(`/api/montadores/buscar?${query.toString()}`, token),
        ]);

        if (diaristasResult.status === "fulfilled") {
          setProfissionais(diaristasResult.value.data?.diaristas ?? []);
        } else {
          setProfissionais([]);
          setDiaristasError(getErrorMessage(diaristasResult.reason, "Erro ao buscar diaristas"));
        }

        if (montadoresResult.status === "fulfilled") {
          setMontadores(montadoresResult.value.data?.montadores ?? []);
        } else {
          setMontadores([]);
          setMontadoresError(getErrorMessage(montadoresResult.reason, "Erro ao buscar montadores"));
        }

        if (diaristasResult.status === "rejected" && montadoresResult.status === "rejected") {
          throw new Error(
            [
              getErrorMessage(diaristasResult.reason, "Erro ao buscar diaristas"),
              getErrorMessage(montadoresResult.reason, "Erro ao buscar montadores"),
            ].join(" | "),
          );
        }
      } catch (err) {
        setError(getErrorMessage(err, "Erro ao buscar profissionais"));
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  return { profissionais, montadores, loading, error, diaristasError, montadoresError, buscar };
}
