import { useCallback, useEffect, useMemo, useState } from "react";
import {
  carregarSafeScoreUsuario,
  carregarServicosMontador,
  type MontadorSafeScore,
  type MontadorServico,
} from "@/api/montadorApi";

const PENDING_STATUS = new Set(["PENDENTE", "SOLICITADO"]);
const AGENDA_STATUS = new Set(["ACEITO", "CONFIRMADO", "EM_ANDAMENTO", "FINALIZADO", "CONCLUIDO"]);

function upper(value: unknown) {
  return String(value ?? "").toUpperCase();
}

export function useMontadorServicos() {
  const [servicos, setServicos] = useState<MontadorServico[]>([]);
  const [scoreByUser, setScoreByUser] = useState<Record<string, MontadorSafeScore | null>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    setError(null);

    try {
      const list = await carregarServicosMontador();
      setServicos(list);

      const employerIds = Array.from(
        new Set(list.map((item) => item.empregador?.id).filter(Boolean) as string[]),
      );
      if (employerIds.length > 0) {
        const entries = await Promise.all(
          employerIds.map(async (id) => [id, await carregarSafeScoreUsuario(id)] as const),
        );
        setScoreByUser(Object.fromEntries(entries));
      } else {
        setScoreByUser({});
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Falha ao carregar serviços do montador.";
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load("initial");
  }, [load]);

  const pendentes = useMemo(
    () => servicos.filter((item) => PENDING_STATUS.has(upper(item.status))),
    [servicos],
  );

  const agenda = useMemo(
    () => servicos.filter((item) => AGENDA_STATUS.has(upper(item.status))),
    [servicos],
  );

  return {
    servicos,
    pendentes,
    agenda,
    scoreByUser,
    loading,
    refreshing,
    error,
    refetch: () => load("refresh"),
    reload: () => load("initial"),
  };
}
