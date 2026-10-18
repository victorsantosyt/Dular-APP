import { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { apiService } from "@/services/api";
import { useAuth } from "@/stores/authStore";
import { formatDate, formatHorario, mapStatus } from "@/utils/formatters";
import { conflitosDoPedido } from "@/lib/conflitoAgenda";
import { useAoMudarConta } from "@/hooks/useSincronizacaoConta";
import { useUltimaLeitura } from "@/hooks/useUltimaLeitura";

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
  /** Rótulo pronto para exibir: "Hoje", "Amanhã" ou "sex., 10 de jul.". */
  data: string;
  /** Data crua do serviço. Necessária para filtrar por período — o rótulo
   *  acima é texto de exibição e não serve para comparar datas. */
  dataISO: string | null;
  hora: string;
  preco: string;
  status: StatusDiarista;
  avatarUrl?: string;
  /** Tipo bruto do serviço (FAXINA | BABA | COZINHEIRA | PASSA_ROUPA). */
  tipo: string;
  /** Categoria/subtipo bruto (ex.: FAXINA_LEVE, BABA_NOTURNA) ou null. */
  categoria: string | null;
  /** Pedido pendente que cruza ou encosta em outro serviço aceito do dia. */
  conflito?: "sobreposto" | "proximo" | null;
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
  CUIDADORA: "Cuidadora",
  LAVADEIRA: "Lavadeira",
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
    dataISO: raw.data ?? null,
    hora: formatHorario(raw.hora, raw.turno),
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

  const iniciarLeitura = useUltimaLeitura();

  const fetchAgendamentos = useCallback(async (silencioso = false) => {
    if (!token) return;
    const vale = iniciarLeitura();
    if (!silencioso) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await apiService.get<ServicosResponse>("/api/servicos/minhas", token);
      if (!vale()) return;
      const brutos = res.data?.servicos ?? [];
      const mapped = brutos.map((raw: any) => {
        const item = mapServico(raw);
        if (String(raw.status).toUpperCase() !== "SOLICITADO") return item;
        const achados = conflitosDoPedido(raw, brutos);
        return {
          ...item,
          conflito: achados.some((c) => c.tipo === "sobreposto")
            ? ("sobreposto" as const)
            : achados.length
              ? ("proximo" as const)
              : null,
        };
      });
      setAgendamentos(mapped);
      setError(null);
    } catch {
      // Falha na releitura automática mantém a lista que já está na tela.
      if (vale() && !silencioso) setError("Erro ao carregar agendamentos");
    } finally {
      if (vale()) setLoading(false);
    }
  }, [token, iniciarLeitura]);

  // Ao FOCAR, não só na montagem. A home monta uma vez e sobrevive à navegação
  // por abas: sem isto, aceitar/concluir um serviço em outra tela não se
  // refletia em "Agendamentos de hoje", nos ganhos nem na barra de limite —
  // a home ficava velha até o pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      fetchAgendamentos();
    }, [fetchAgendamentos]),
  );

  // Solicitação nova, aceite, cancelamento ou conclusão (por qualquer ponta).
  useAoMudarConta(["servicos"], () => { void fetchAgendamentos(true); });

  const refetch = useCallback(() => fetchAgendamentos(), [fetchAgendamentos]);
  return { agendamentos, loading, error, refetch };
}
