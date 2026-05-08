import { useCallback, useEffect, useState } from "react";
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

  const fetch = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const res = await api.get<{ user?: PerfilUsuario } | PerfilUsuario>("/api/me");
      const data = (res.data as any).user ?? res.data;
      setPerfil(data as PerfilUsuario);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar perfil");
    } finally {
      if (isInitial) setLoading(false);
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
      setSaving(true);
      try {
        const res = await api.put<{ user?: PerfilUsuario } | PerfilUsuario>(
          "/api/me",
          dados
        );
        const updated = (res.data as any).user ?? res.data;
        setPerfil((prev) =>
          prev ? { ...prev, ...(updated as Partial<PerfilUsuario>) } : updated
        );
        return true;
      } catch {
        return false;
      } finally {
        setSaving(false);
      }
    },
    []
  );

  return { perfil, loading, saving, error, atualizar, refetch };
}
