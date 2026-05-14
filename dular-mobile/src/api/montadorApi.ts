import { api } from "@/lib/api";
import type { Me } from "@/api/perfilApi";

export type MontadorStatus =
  | "PENDENTE"
  | "SOLICITADO"
  | "ACEITO"
  | "CONFIRMADO"
  | "EM_ANDAMENTO"
  | "FINALIZADO"
  | "CONCLUIDO"
  | "CANCELADO"
  | "RECUSADO"
  | "EXPIRADO";

export type MontadorSafeScore = {
  faixa?: string;
  cor?: string;
  bloqueado?: boolean;
  totalServicos?: number;
  verificado?: boolean;
};

type EmpregadorResumo = {
  id: string;
  nome?: string | null;
  telefone?: string | null;
  avatarUrl?: string | null;
};

export type MontadorServico = {
  id: string;
  status: MontadorStatus | string;
  tipo?: string | null;
  tipoServico?: string | null;
  categoria?: string | null;
  subcategoria?: string | null;
  data?: string | Date | null;
  turno?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  endereco?: string | null;
  enderecoCompleto?: string | null;
  observacoes?: string | null;
  fotos?: string[];
  precoFinal?: number | null;
  valorEstimado?: number | null;
  empregador?: EmpregadorResumo | null;
};

type MontadorServicoWire = Omit<MontadorServico, "empregador"> & {
  empregador?: EmpregadorResumo | null;
  cliente?: EmpregadorResumo | null;
};

type ServicosResponse = {
  ok?: boolean;
  servicos?: MontadorServicoWire[];
};

export const MONTADOR_SERVICOS = [
  "Montagem de móveis",
  "Guarda-roupa",
  "Cama",
  "Mesa",
  "Painel de TV",
  "Prateleiras",
  "Pequenos reparos",
  "Instalação simples",
  "Manutenção residencial",
] as const;

export const MONTADOR_ESPECIALIDADES = [
  { id: "montagem", label: "Montagem de móveis" },
  { id: "reparos", label: "Pequenos reparos" },
  { id: "eletrica", label: "Instalação elétrica" },
  { id: "hidraulica", label: "Instalação hidráulica" },
  { id: "pintura", label: "Pintura" },
  { id: "carpintaria", label: "Carpintaria" },
] as const;

export type MontadorEspecialidadeId = (typeof MONTADOR_ESPECIALIDADES)[number]["id"];

export type MontadorPerfilCompletude = {
  completo: boolean;
  progresso: number;
  requisitos: {
    nome: boolean;
    apresentacao: boolean;
    especialidades: boolean;
    areaAtendimento: boolean;
    ativo: boolean;
  };
};

export type MontadorPerfilProfissional = {
  id: string;
  userId: string;
  bio?: string | null;
  especialidades: MontadorEspecialidadeId[];
  anosExperiencia?: number | null;
  cidade?: string | null;
  estado?: string | null;
  cidadeAtual?: string | null;
  estadoAtual?: string | null;
  bairroAtual?: string | null;
  localizacaoPermitida?: boolean;
  localizacaoAtualizadaEm?: string | null;
  bairros: string[];
  atendeTodaCidade: boolean;
  raioAtendimentoKm?: number | null;
  fotoPerfil?: string | null;
  portfolioFotos: string[];
  precoBase?: number | null;
  taxaMinima?: number | null;
  cobraDeslocamento: boolean;
  observacaoPreco?: string | null;
  valorACombinar: boolean;
  documentoFrente?: string | null;
  documentoVerso?: string | null;
  selfieDoc?: string | null;
  documentosEnviados: boolean;
  verificacaoStatus: "NAO_ENVIADO" | "PENDENTE" | "APROVADO" | "REPROVADO";
  verificado: boolean;
  ativo: boolean;
  rating: number;
  totalServicos: number;
  completude: MontadorPerfilCompletude;
  safeScore?: (MontadorSafeScore & { score?: number; tier?: string }) | null;
  avaliacoes?: {
    media: number;
    total: number;
    itens: Array<{
      id: string;
      notaGeral: number;
      comentario?: string | null;
      createdAt: string;
    }>;
  };
};

export type MontadorPerfilMe = {
  ok?: boolean;
  user: Me & {
    notaMedia?: number;
    totalServicos?: number;
    especialidades?: MontadorEspecialidadeId[];
    cidade?: string | null;
    estado?: string | null;
    cidadeAtual?: string | null;
    estadoAtual?: string | null;
    bairroAtual?: string | null;
    localizacaoPermitida?: boolean;
    localizacaoAtualizadaEm?: string | null;
    bairros?: string[];
  };
  perfil: MontadorPerfilProfissional;
};

export type AtualizarPerfilMontadorPayload = {
  nome?: string;
  telefone?: string | null;
  bio?: string | null;
  anosExperiencia?: number | null;
  especialidades?: MontadorEspecialidadeId[];
  cidade?: string | null;
  estado?: string | null;
  bairros?: string[];
  atendeTodaCidade?: boolean;
  raioAtendimentoKm?: number | null;
  precoBase?: number | null;
  taxaMinima?: number | null;
  cobraDeslocamento?: boolean;
  observacaoPreco?: string | null;
  valorACombinar?: boolean;
  ativo?: boolean;
  portfolioFotos?: string[];
};

export async function carregarServicosMontador(): Promise<MontadorServico[]> {
  const res = await api.get<ServicosResponse>("/api/servicos/minhas");
  const list = Array.isArray(res.data?.servicos) ? res.data.servicos : [];
  return list.map(({ cliente, empregador, ...servico }) => ({
    ...servico,
    empregador: empregador ?? cliente ?? null,
  }));
}

export async function aceitarSolicitacaoMontador(servicoId: string) {
  const res = await api.post(`/api/servicos/${servicoId}/aceitar`);
  return res.data;
}

export async function recusarSolicitacaoMontador(servicoId: string) {
  const res = await api.post(`/api/servicos/${servicoId}/recusar`);
  return res.data;
}

export async function iniciarServicoMontador(servicoId: string) {
  const res = await api.post(`/api/servicos/${servicoId}/iniciar`);
  return res.data;
}

export async function finalizarServicoMontador(servicoId: string) {
  const res = await api.post(`/api/servicos/${servicoId}/concluir`);
  return res.data;
}

export async function cancelarServicoMontador(servicoId: string) {
  const res = await api.post(`/api/servicos/${servicoId}/cancelar`, {
    motivo: "Cancelado pelo montador no aplicativo.",
  });
  return res.data;
}

export async function carregarPerfilMontador(): Promise<MontadorPerfilMe> {
  const res = await api.get<MontadorPerfilMe>("/api/montador/me");
  return res.data;
}

export async function atualizarPerfilMontador(payload: AtualizarPerfilMontadorPayload): Promise<MontadorPerfilMe> {
  const res = await api.patch<MontadorPerfilMe>("/api/montador/me", payload);
  return res.data;
}

export async function carregarSafeScoreUsuario(userId: string): Promise<MontadorSafeScore | null> {
  try {
    const res = await api.get<MontadorSafeScore>(`/api/usuarios/${userId}/score`);
    return res.data;
  } catch {
    return null;
  }
}

export async function acionarSosMontador(servicoId: string, mensagem?: string) {
  const res = await api.post("/api/seguranca/sos", {
    servicoId,
    mensagem: mensagem ?? "SOS acionado pelo montador no aplicativo.",
  });
  return res.data;
}
