import { useCallback, useEffect, useRef, useState } from "react";
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
  const inFlight = useRef(false);
  // Hotfix T-13 (2): guard mounted para evitar setState após unmount e
  // garantir que inFlight é resetado mesmo se throw acontecer.
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetch = useCallback(async () => {
    if (inFlight.current) return; // Hotfix T-13: evita rajada quando /api/me/restrictions está lento
    inFlight.current = true;
    try {
      const res = await api.get<Restricoes>("/api/me/restrictions");
      if (mountedRef.current) setRestricoes(res.data);
    } catch {
      // fail open — no restrictions on error
    } finally {
      // CRÍTICO: sempre reseta inFlight, mesmo se desmontou.
      inFlight.current = false;
      if (mountedRef.current) setLoading(false);
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
