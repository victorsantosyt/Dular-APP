import { api } from "@/lib/api";
import type { ServiceCategory } from "@/screens/empregador/service-flow/ServiceFlowContext";

const CATEGORIA_TO_TIPO: Record<ServiceCategory, string | null> = {
  diarista: "FAXINA",
  baba: "BABA",
  cozinheira: "COZINHEIRA",
  montador: "MONTADOR",
  cuidadora: "CUIDADORA",
  passadeira: "PASSA_ROUPA",
  lavadeira: "LAVADEIRA",
};

function horarioParaTurno(horario: string): "MANHA" | "TARDE" {
  const hora = parseInt(horario.split(":")[0] ?? "10", 10);
  return hora < 12 ? "MANHA" : "TARDE";
}

export interface CriarServicoPayload {
  tipo: string;
  categoria?: string;
  dataISO: string;
  turno: "MANHA" | "TARDE";
  cidade: string;
  uf: string;
  bairro: string;
  diaristaUserId?: string;
  montadorUserId?: string;
  enderecoCompleto?: string;
  observacoes?: string;
}

export interface CriarServicoResult {
  ok: boolean;
  servicoId: string;
}

export async function criarServico(
  payload: CriarServicoPayload,
): Promise<CriarServicoResult> {
  const res = await api.post<CriarServicoResult>("/api/servicos", payload);
  return res.data;
}

export async function cancelarServicoEmpregador(
  servicoId: string,
  motivo: string,
  observacao?: string,
) {
  const res = await api.post(`/api/servicos/${servicoId}/cancelar`, {
    motivo,
    ...(observacao ? { observacao } : {}),
  });
  return res.data;
}

export async function confirmarFinalizacaoEmpregador(servicoId: string) {
  // Endpoint T-14: dupla confirmação (EM_ANDAMENTO → AGUARDANDO_FINALIZACAO → CONCLUIDO).
  // Não usar /confirmar (legado, CONCLUIDO → CONFIRMADO usado só no caminho de avaliação).
  const res = await api.post(`/api/servicos/${servicoId}/confirmar-finalizacao`);
  return res.data;
}

export async function aprovarServicoConcluido(servicoId: string) {
  // Endpoint legado /confirmar: avança CONCLUIDO → CONFIRMADO (libera o
  // caminho de avaliação). Só o empregador participante pode chamar.
  const res = await api.post(`/api/servicos/${servicoId}/confirmar`);
  return res.data;
}

// Reagendamento (com aprovação): o profissional propõe; o empregador decide.
export async function decidirReagendamento(servicoId: string, aceitar: boolean) {
  const res = await api.patch(`/api/servicos/${servicoId}/reagendar`, { aceitar });
  return res.data;
}

type DraftSlice = {
  categoria: ServiceCategory;
  tipo?: "DIARISTA" | "MONTADOR";
  profissionalId?: string;
  especialidadeId?: string;
  especialidadeLabel?: string;
  categoriaBackend?: string;
  dataISO: string;
  horario: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  observacoes: string;
};

export type PrepareResult =
  | { ok: true; payload: CriarServicoPayload }
  | { ok: false; error: string };

export function prepararPayload(draft: DraftSlice): PrepareResult {
  const tipo = CATEGORIA_TO_TIPO[draft.categoria];
  const isMontador = draft.tipo === "MONTADOR" || draft.categoria === "montador" || tipo === "MONTADOR";
  if (!tipo) {
    return {
      ok: false,
      error: `Contratação de "${draft.categoria}" ainda não está disponível online.`,
    };
  }

  if (!draft.profissionalId) {
    return {
      ok: false,
      error: isMontador
        ? "Não foi possível identificar o montador selecionado. Volte e escolha um profissional novamente."
        : "Selecione um profissional antes de confirmar a solicitação.",
    };
  }

  if (isMontador) {
    if (!draft.categoriaBackend) {
      return {
        ok: false,
        error: "Selecione a especialidade do montador antes de confirmar.",
      };
    }

    if (draft.observacoes.trim().length < 20) {
      return {
        ok: false,
        error: "Descreva o serviço do montador com pelo menos 20 caracteres.",
      };
    }
  }

  // Endereço real do atendimento. cidade/uf/bairro vêm da localização salva
  // do Empregador (pré-preenchida na tela de endereço); rua/numero/complemento
  // são informados no fluxo. Sem fallback fixo: bloqueia se faltar o essencial.
  const cidade = draft.cidade.trim();
  const uf = draft.uf.trim().toUpperCase();
  const bairro = draft.bairro.trim();
  const rua = draft.rua.trim();

  if (!cidade || uf.length !== 2) {
    return {
      ok: false,
      error:
        "Defina sua localização (cidade e UF) no perfil ou na busca antes de solicitar um serviço.",
    };
  }
  if (!bairro) {
    return {
      ok: false,
      error: "Informe o bairro do atendimento para continuar.",
    };
  }
  if (!rua) {
    return {
      ok: false,
      error: "Informe a rua/logradouro do atendimento para continuar.",
    };
  }

  const partes = [
    rua,
    draft.numero ? `nº ${draft.numero}` : null,
    draft.complemento || null,
  ].filter(Boolean);

  const basePayload = {
    tipo,
    // Subtipo do serviço: montador (especialidade) ou diarista (intensidade,
    // ex.: FAXINA_LEVE). O backend valida contra CAT_BY_TIPO e calcula o preço.
    categoria: draft.categoriaBackend ?? undefined,
    dataISO: draft.dataISO,
    turno: horarioParaTurno(draft.horario || "10:00"),
    cidade,
    uf,
    bairro,
    enderecoCompleto: partes.join(", "),
    observacoes: draft.observacoes || undefined,
  };

  return {
    ok: true,
    payload:
      isMontador
        ? { ...basePayload, montadorUserId: draft.profissionalId }
        : { ...basePayload, diaristaUserId: draft.profissionalId },
  };
}
