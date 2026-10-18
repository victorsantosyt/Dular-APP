import { useCallback, useEffect, useMemo, useState } from "react";
import {
  carregarSafeScoreUsuario,
  carregarServicosMontador,
  type MontadorSafeScore,
  type MontadorServico,
} from "@/api/montadorApi";
import { useAoMudarConta } from "@/hooks/useSincronizacaoConta";
import { useUltimaLeitura } from "@/hooks/useUltimaLeitura";

const PENDING_STATUS = new Set(["PENDENTE", "SOLICITADO"]);
const AGENDA_STATUS = new Set([
  "ACEITO",
  "CONFIRMADO",
  "EM_ANDAMENTO",
  "AGUARDANDO_FINALIZACAO",
  "FINALIZADO",
  "CONCLUIDO",
]);

function upper(value: unknown) {
  return String(value ?? "").toUpperCase();
}

export function useMontadorServicos() {
  const [servicos, setServicos] = useState<MontadorServico[]>([]);
  const [scoreByUser, setScoreByUser] = useState<Record<string, MontadorSafeScore | null>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const iniciarLeitura = useUltimaLeitura();

  const load = useCallback(async (mode: "initial" | "refresh" | "silent" = "initial") => {
    const vale = iniciarLeitura();
    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    if (mode !== "silent") setError(null);

    try {
      const list = await carregarServicosMontador();
      if (!vale()) return;
      setServicos(list);
      setError(null);

      const employerIds = Array.from(
        new Set(list.map((item) => item.empregador?.id).filter(Boolean) as string[]),
      );
      if (employerIds.length > 0) {
        const entries = await Promise.all(
          employerIds.map(async (id) => [id, await carregarSafeScoreUsuario(id)] as const),
        );
        if (vale()) setScoreByUser(Object.fromEntries(entries));
      } else {
        setScoreByUser({});
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Falha ao carregar serviços do montador.";
      // Falha na releitura automática mantém a lista que já está na tela.
      if (vale() && mode !== "silent") setError(message);
    } finally {
      if (vale()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [iniciarLeitura]);

  useEffect(() => {
    void load("initial");
  }, [load]);

  // Solicitação nova, aceite, cancelamento ou conclusão (por qualquer ponta).
  useAoMudarConta(["servicos"], () => { void load("silent"); });

  const pendentes = useMemo(
    () => servicos.filter((item) => PENDING_STATUS.has(upper(item.status))),
    [servicos],
  );

  const agenda = useMemo(
    () => servicos.filter((item) => AGENDA_STATUS.has(upper(item.status))),
    [servicos],
  );

  // Callbacks estáveis: sem isso, cada render cria um novo reload/refetch e a
  // tela de detalhe (useFocusEffect com dep [reload]) re-dispara o efeito a cada
  // render → loop de GET /api/servicos/minhas.
  const refetch = useCallback(() => load("refresh"), [load]);
  const reload = useCallback(() => load("initial"), [load]);

  return {
    servicos,
    pendentes,
    agenda,
    scoreByUser,
    loading,
    refreshing,
    error,
    refetch,
    reload,
  };
}
