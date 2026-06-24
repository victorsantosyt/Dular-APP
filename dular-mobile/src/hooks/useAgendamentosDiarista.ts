import { useState, useCallback, useEffect } from "react";
import { apiService } from "@/services/api";
import { useAuth } from "@/stores/authStore";
import { formatDate, formatHora, mapStatus } from "@/utils/formatters";

export type StatusDiarista =
  | "pendente"
  | "confirmado"
  | "andamento"
  | "aguardando"
  | "finalizado"
  | "cancelado";

export interface AgendamentoDiarista {
  id: string;
  nomeCliente: string;
  avaliacao: string;
  localizacao: string;
  servico: string;
  /** Rótulo do serviço já resolvido: a categoria/intensidade quando houver
   *  (ex.: "Limpeza pesada"), senão o tipo (ex.: "Limpeza"). */
  servicoLabel: string;
  data: string;
  hora: string;
  preco: string;
  status: StatusDiarista;
  avatarUrl?: string;
  /** Tipo bruto do serviço (FAXINA | BABA | COZINHEIRA | PASSA_ROUPA). */
  tipo: string;
  /** Categoria/subtipo bruto (ex.: FAXINA_LEVE, BABA_NOTURNA) ou null. */
  categoria: string | null;
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

const CATEGORIA_LABEL: Record<string, string> = {
  FAXINA_LEVE: "Limpeza leve",
  FAXINA_COMPLETA: "Limpeza completa",
  FAXINA_PESADA: "Limpeza pesada",
  BABA_DIURNA: "Babá diurna",
  BABA_NOTURNA: "Babá noturna",
  BABA_INTEGRAL: "Babá integral",
  COZINHEIRA_DIARIA: "Cozinha diária",
  COZINHEIRA_EVENTO: "Cozinha para evento",
  PASSA_ROUPA_BASICO: "Passar roupa — básico",
  PASSA_ROUPA_COMPLETO: "Passar roupa — completo",
};

const STATUS_DIARISTA_MAP: Record<string, StatusDiarista> = {
  pendente: "pendente",
  aceita: "confirmado",
  confirmado: "confirmado",
  andamento: "andamento",
  aguardando: "aguardando",
  concluida: "finalizado",
  finalizado: "finalizado",
  cancelada: "cancelado",
  recusado: "cancelado",
};

function mapServico(raw: any): AgendamentoDiarista {
  const baseStatus = mapStatus(raw.status);
  const tipoLabel = TIPO_LABEL[raw.tipo] ?? raw.tipo ?? "Serviço";
  const categoria = raw.categoria ?? null;
  return {
    id: raw.id,
    nomeCliente: raw.cliente?.nome ?? "Cliente",
    avaliacao: "5,0",
    localizacao: raw.endereco ?? (raw.bairro ? `${raw.bairro}, ${raw.uf}` : "--"),
    servico: tipoLabel,
    servicoLabel: (categoria && CATEGORIA_LABEL[categoria]) || tipoLabel,
    data: formatDate(raw.data),
    hora: formatHora(raw.turno),
    preco: raw.precoFinal != null ? String(raw.precoFinal) : "--",
    status: STATUS_DIARISTA_MAP[baseStatus] ?? "pendente",
    avatarUrl: raw.cliente?.avatarUrl ?? undefined,
    tipo: raw.tipo ?? "",
    categoria,
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
