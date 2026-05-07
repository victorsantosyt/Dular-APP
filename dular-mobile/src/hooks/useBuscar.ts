import { useState, useCallback } from "react";
import { apiService } from "@/services/api";
import { useAuth } from "@/stores/authStore";

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
  bairro: string;
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buscar = useCallback(
    async (params: BuscarParams) => {
      if (!token || !params.cidade || !params.uf || !params.bairro) return;
      setLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams({
          cidade: params.cidade,
          uf: params.uf,
          bairro: params.bairro,
        });
        if (params.tipo) query.set("tipo", params.tipo);
        if (params.categoria) query.set("categoria", params.categoria);

        const res = await apiService.get<BuscarResponse>(
          `/api/diaristas/buscar?${query.toString()}`,
          token
        );
        setProfissionais(res.data?.diaristas ?? []);
      } catch {
        setError("Erro ao buscar profissionais");
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  return { profissionais, loading, error, buscar };
}
