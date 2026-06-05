import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/authStore";

export type FavoritoTipo = "DIARISTA" | "MONTADOR";

type FavoritoApiItem = { userId: string; tipo: FavoritoTipo };
type FavoritosListResponse = { ok?: boolean; favoritos?: FavoritoApiItem[] };

function favKey(userId: string, tipo: FavoritoTipo): string {
  return `${tipo}:${userId}`;
}

/**
 * useFavoritos
 *
 * Gerencia o conjunto de profissionais favoritados pelo empregador logado.
 * Carrega a lista real via GET /api/empregador/favoritos e expõe `toggle`
 * com atualização otimista + revert automático em caso de erro de rede.
 * Não duplica favorito local sem confirmação do backend (idempotência é
 * garantida pelo upsert/delete idempotente do endpoint).
 */
export function useFavoritos() {
  const { token } = useAuth();
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const favRef = useRef<Set<string>>(new Set());
  const pending = useRef<Set<string>>(new Set());

  const apply = useCallback((next: Set<string>) => {
    favRef.current = next;
    setFavoritos(next);
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api.get<FavoritosListResponse>("/api/empregador/favoritos");
      if (res.data?.ok && Array.isArray(res.data.favoritos)) {
        apply(new Set(res.data.favoritos.map((f) => favKey(f.userId, f.tipo))));
      }
    } catch {
      // Lista de favoritos indisponível não bloqueia a busca; mantém o estado atual.
    } finally {
      setLoading(false);
    }
  }, [token, apply]);

  useEffect(() => {
    load();
  }, [load]);

  const isFavorito = useCallback(
    (userId: string, tipo: FavoritoTipo) => favoritos.has(favKey(userId, tipo)),
    [favoritos],
  );

  const toggle = useCallback(
    async (userId: string, tipo: FavoritoTipo) => {
      const key = favKey(userId, tipo);
      // Evita duplo toque enquanto a requisição anterior do mesmo item não resolveu.
      if (pending.current.has(key)) return;
      pending.current.add(key);

      const wasFav = favRef.current.has(key);
      const optimistic = new Set(favRef.current);
      if (wasFav) optimistic.delete(key);
      else optimistic.add(key);
      apply(optimistic);

      try {
        if (wasFav) {
          await api.delete(
            `/api/empregador/favoritos?profissionalUserId=${encodeURIComponent(userId)}&tipo=${tipo}`,
          );
        } else {
          await api.post("/api/empregador/favoritos", { profissionalUserId: userId, tipo });
        }
      } catch (err) {
        // Reverte a UI otimista preservando outras mudanças ocorridas no intervalo.
        const reverted = new Set(favRef.current);
        if (wasFav) reverted.add(key);
        else reverted.delete(key);
        apply(reverted);
        throw err;
      } finally {
        pending.current.delete(key);
      }
    },
    [apply],
  );

  return { isFavorito, toggle, loading, reload: load };
}
