import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type Plano = "BASICO" | "PLUS" | "PREMIUM";

interface Restricoes {
  plano: Plano;
  limites: {
    servicosMes: number | null;
    aceiteMes: number | null;
  };
  uso: {
    servicosMes: number;
    aceiteMes: number;
  };
}

interface UseRestricoesReturn {
  restricoes: Restricoes | null;
  loading: boolean;
  atingiuLimite: (tipo: "servicosMes" | "aceiteMes") => boolean;
  refetch: () => void;
}

export function useRestricoes(): UseRestricoesReturn {
  const [restricoes, setRestricoes] = useState<Restricoes | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const res = await api.get<Restricoes>("/api/me/restrictions");
      setRestricoes(res.data);
    } catch {
      // fail open — no restrictions on error
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(() => {
    void fetch();
  }, [fetch]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const atingiuLimite = useCallback(
    (tipo: "servicosMes" | "aceiteMes"): boolean => {
      if (!restricoes) return false;
      const limite = restricoes.limites[tipo];
      if (limite === null) return false;
      return restricoes.uso[tipo] >= limite;
    },
    [restricoes]
  );

  return { restricoes, loading, atingiuLimite, refetch };
}
