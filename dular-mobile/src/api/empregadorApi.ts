import { api } from "@/lib/api";
import type { ServiceCategory } from "@/screens/empregador/service-flow/ServiceFlowContext";

const CATEGORIA_TO_TIPO: Record<ServiceCategory, string | null> = {
  diarista: "FAXINA",
  baba: "BABA",
  cozinheira: "COZINHEIRA",
  montador: null, // TODO: endpoint /api/servicos ainda não suporta MONTADOR; rota separada pendente
};

function horarioParaTurno(horario: string): "MANHA" | "TARDE" {
  const hora = parseInt(horario.split(":")[0] ?? "10", 10);
  return hora < 12 ? "MANHA" : "TARDE";
}

export interface CriarServicoPayload {
  tipo: string;
  dataISO: string;
  turno: "MANHA" | "TARDE";
  cidade: string;
  uf: string;
  bairro: string;
  diaristaUserId: string;
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

type DraftSlice = {
  categoria: ServiceCategory;
  profissionalId?: string;
  dataISO: string;
  horario: string;
  numero: string;
  complemento: string;
  observacoes: string;
};

export type PrepareResult =
  | { ok: true; payload: CriarServicoPayload }
  | { ok: false; error: string };

export function prepararPayload(draft: DraftSlice): PrepareResult {
  const tipo = CATEGORIA_TO_TIPO[draft.categoria];
  if (!tipo) {
    return {
      ok: false,
      error: `Contratação de "${draft.categoria}" ainda não está disponível online.`,
    };
  }

  if (!draft.profissionalId) {
    return {
      ok: false,
      error: "Selecione um profissional antes de confirmar a solicitação.",
    };
  }

  const partes = [
    "Rua Oscar Freire, 245", // TODO: coletar do endereço cadastrado no perfil do usuário
    draft.numero ? `nº ${draft.numero}` : null,
    draft.complemento || null,
  ].filter(Boolean);

  return {
    ok: true,
    payload: {
      tipo,
      dataISO: draft.dataISO,
      turno: horarioParaTurno(draft.horario || "10:00"),
      cidade: "São Paulo",      // TODO: coletar cidade do perfil do usuário
      uf: "SP",                 // TODO: coletar UF do perfil do usuário
      bairro: "Jardim América", // TODO: coletar bairro do perfil do usuário
      diaristaUserId: draft.profissionalId,
      enderecoCompleto: partes.join(", "),
      observacoes: draft.observacoes || undefined,
    },
  };
}
