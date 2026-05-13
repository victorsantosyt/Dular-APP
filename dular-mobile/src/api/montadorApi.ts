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

export async function carregarPerfilMontador(): Promise<Me> {
  const res = await api.get<{ user?: Me } | Me>("/api/me");
  const payload = res.data as { user?: Me };
  return payload.user ?? (res.data as Me);
}

export async function atualizarPerfilMontador(payload: {
  nome?: string;
  bio?: string;
  precoLeve?: number;
  precoMedio?: number;
  precoPesada?: number;
}) {
  const res = await api.put("/api/me", payload);
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
