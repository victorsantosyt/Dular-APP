import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

export interface PerfilUsuario {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  bio?: string;
  avatarUrl?: string;
  role: "EMPREGADOR" | "DIARISTA" | "MONTADOR" | "ADMIN";
  verificado: boolean;
  safeScore?: number;
  criadoEm: string;
}

export interface UsePerfilReturn {
  perfil: PerfilUsuario | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  atualizar: (
    dados: Partial<Pick<PerfilUsuario, "nome" | "bio" | "telefone">>
  ) => Promise<boolean>;
  refetch: () => void;
}

export function usePerfil(): UsePerfilReturn {
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Hotfix T-13: GET /api/me pode levar ~20s em cenários degradados.
  // Sem guard, o useEffect inicial + o useFocusEffect que chama refetch
  // disparavam requests paralelos, agravando o travamento.
  const inFlight = useRef(false);
  // Hotfix T-13 (2): se o componente desmontar enquanto a request está em
  // voo, ignorar a resposta para não setar state em árvore desmontada.
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetch = useCallback(async (isInitial = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (isInitial && mountedRef.current) setLoading(true);
    try {
      const res = await api.get<{ user?: PerfilUsuario } | PerfilUsuario>("/api/me");
      if (!mountedRef.current) return;
      const data = (res.data as any).user ?? res.data;
      setPerfil(data as PerfilUsuario);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Erro ao carregar perfil");
    } finally {
      // CRÍTICO: sempre reseta os flags, mesmo se desmontou. Sem isso, um
      // throw inesperado pode deixar inFlight travado para sempre.
      inFlight.current = false;
      if (mountedRef.current && isInitial) setLoading(false);
    }
  }, []);

  const refetch = useCallback(() => {
    void fetch(false);
  }, [fetch]);

  useEffect(() => {
    void fetch(true);
  }, [fetch]);

  const atualizar = useCallback(
    async (dados: Partial<Pick<PerfilUsuario, "nome" | "bio" | "telefone">>) => {
      if (mountedRef.current) setSaving(true);
      try {
        const res = await api.put<{ user?: PerfilUsuario } | PerfilUsuario>(
          "/api/me",
          dados
        );
        if (!mountedRef.current) return true;
        const updated = (res.data as any).user ?? res.data;
        setPerfil((prev) =>
          prev ? { ...prev, ...(updated as Partial<PerfilUsuario>) } : updated
        );
        return true;
      } catch {
        return false;
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    []
  );

  return { perfil, loading, saving, error, atualizar, refetch };
}
