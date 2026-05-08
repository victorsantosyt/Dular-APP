import { useState, useCallback, useEffect } from "react";
import { apiService } from "@/services/api";
import { useAuth } from "@/stores/authStore";
import { formatDate, formatHora } from "@/utils/formatters";
import type { AppIconName } from "@/components/ui";

type CategoriaKey = "diarista" | "baba" | "cozinheira" | "exp";

const TIPO_TO_KEY: Record<string, CategoriaKey> = {
  FAXINA: "diarista",
  BABA: "baba",
  COZINHEIRA: "cozinheira",
  PASSA_ROUPA: "exp",
};

const TIPO_TO_ICON: Record<string, AppIconName> = {
  FAXINA: "Sparkles",
  BABA: "Baby",
  COZINHEIRA: "ChefHat",
  PASSA_ROUPA: "Shirt",
};

const TIPO_TO_LABEL: Record<string, string> = {
  FAXINA: "Diarista",
  BABA: "Babá",
  COZINHEIRA: "Cozinheira",
  PASSA_ROUPA: "Passadeira",
};

export type StatusAgendamento = "pendente" | "aceita" | "andamento" | "concluida" | "cancelada";

export interface AgendamentoEmpregador {
  id: string;
  nome: string;
  idade: string;
  categoria: string;
  categoriaKey: CategoriaKey;
  categoriaIcon: AppIconName;
  localizacao: string;
  data: string;
  hora: string;
  avaliacao: string;
  experiencia: string;
  preco: string;
  status: StatusAgendamento;
  avatarUrl?: string;
}

interface ServicosResponse {
  ok: boolean;
  servicos: any[];
}

function toEmpregadorStatus(raw: string): StatusAgendamento {
  const map: Record<string, StatusAgendamento> = {
    SOLICITADO: "pendente",
    PENDENTE: "pendente",
    ACEITO: "aceita",
    CONFIRMADO: "aceita",
    EM_ANDAMENTO: "andamento",
    CONCLUIDO: "concluida",
    FINALIZADO: "concluida",
    CANCELADO: "cancelada",
  };
  return map[raw] ?? "pendente";
}

function mapServicoEmpregador(raw: any): AgendamentoEmpregador {
  return {
    id: raw.id,
    nome: raw.diarista?.nome ?? "A definir",
    idade: "--",
    categoria: TIPO_TO_LABEL[raw.tipo] ?? raw.tipo ?? "Serviço",
    categoriaKey: TIPO_TO_KEY[raw.tipo] ?? "exp",
    categoriaIcon: TIPO_TO_ICON[raw.tipo] ?? "User",
    localizacao: raw.endereco ?? (raw.bairro ? `${raw.bairro}, ${raw.uf}` : "--"),
    data: formatDate(raw.data),
    hora: formatHora(raw.turno),
    avaliacao: "--",
    experiencia: "--",
    preco: raw.precoFinal != null ? String(raw.precoFinal) : "--",
    status: toEmpregadorStatus(raw.status),
    avatarUrl: undefined,
  };
}

export function useAgendamentosEmpregador() {
  const { token } = useAuth();
  const [agendamentos, setAgendamentos] = useState<AgendamentoEmpregador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgendamentos = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.get<ServicosResponse>("/api/servicos/minhas", token);
      const mapped = (res.data?.servicos ?? []).map(mapServicoEmpregador);
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
