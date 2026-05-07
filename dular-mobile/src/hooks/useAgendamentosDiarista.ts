import { useState, useCallback, useEffect } from "react";
import { apiService } from "@/services/api";
import { useAuth } from "@/stores/authStore";
import { formatDate, formatHora, mapStatus } from "@/utils/formatters";

export type StatusDiarista = "pendente" | "confirmado" | "andamento" | "finalizado" | "cancelado";

export interface AgendamentoDiarista {
  id: string;
  nomeCliente: string;
  avaliacao: string;
  localizacao: string;
  servico: string;
  data: string;
  hora: string;
  preco: string;
  status: StatusDiarista;
  avatarUrl?: string;
}

interface ServicosResponse {
  ok: boolean;
  servicos: any[];
}

const TIPO_LABEL: Record<string, string> = {
  FAXINA: "Limpeza",
  BABA: "Babá",
  COZINHEIRA: "Cozinha",
  PASSA_ROUPA: "Passar Roupa",
};

const STATUS_DIARISTA_MAP: Record<string, StatusDiarista> = {
  pendente: "pendente",
  aceita: "confirmado",
  confirmado: "confirmado",
  andamento: "andamento",
  concluida: "finalizado",
  finalizado: "finalizado",
  cancelada: "cancelado",
};

function mapServico(raw: any): AgendamentoDiarista {
  const baseStatus = mapStatus(raw.status);
  return {
    id: raw.id,
    nomeCliente: raw.cliente?.nome ?? "Cliente",
    avaliacao: "5,0",
    localizacao: raw.endereco ?? (raw.bairro ? `${raw.bairro}, ${raw.uf}` : "--"),
    servico: TIPO_LABEL[raw.tipo] ?? raw.tipo ?? "Serviço",
    data: formatDate(raw.data),
    hora: formatHora(raw.turno),
    preco: raw.precoFinal != null ? String(raw.precoFinal) : "--",
    status: STATUS_DIARISTA_MAP[baseStatus] ?? "pendente",
    avatarUrl: undefined,
  };
}

export function useAgendamentosDiarista() {
  const { token } = useAuth();
  const [agendamentos, setAgendamentos] = useState<AgendamentoDiarista[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgendamentos = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.get<ServicosResponse>("/api/servicos/minhas", token);
      const mapped = (res.data?.servicos ?? []).map(mapServico);
      setAgendamentos(mapped);
    } catch {
      setError("Erro ao carregar agendamentos");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAgendamentos();
  }, [fetchAgendamentos]);

  return { agendamentos, loading, error, refetch: fetchAgendamentos };
}
