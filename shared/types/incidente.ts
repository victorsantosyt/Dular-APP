import type { DateString } from "./common";
import type { Usuario } from "./usuario";

export type IncidentType = "ASSEDIO" | "IMPORTUNACAO" | "VIOLENCIA" | "AMEACA" | "OUTRO";
export type IncidentStatus = "ABERTO" | "EM_ANALISE" | "CONFIRMADO" | "ENCERRADO";
export type IncidentSeverity = "BAIXA" | "MEDIA" | "ALTA";
export type IncidenteCategoria =
  | "AGRESSAO_VERBAL"
  | "AGRESSAO_FISICA"
  | "AGRESSAO_PSICOLOGICA"
  | "AGRESSAO_EMOCIONAL"
  | "VIOLENCIA_SEXUAL"
  | "IMPORTUNACAO_SEXUAL"
  | "FURTO"
  | "DANO_MATERIAL"
  | "AMBIENTE_INSALUBRE"
  | "VIOLACAO_PRIVACIDADE"
  | "NO_SHOW"
  | "OUTRO";
export type IncidenteGravidade = "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
export type IncidenteResolucao = "CONFIRMADA" | "ARQUIVADA" | "EM_ANALISE" | "AGUARDANDO_EVIDENCIA";

// Sincronizar com schema.prisma se o modelo mudar
export type Incidente = {
  id: string;
  reportedById: string;
  reportedUserId: string;
  serviceId: string | null;
  type: IncidentType;
  severity: IncidentSeverity;
  categoria: IncidenteCategoria;
  subtipo: string | null;
  gravidade: IncidenteGravidade;
  resolucao: IncidenteResolucao | null;
  anonimo: boolean;
  description: string;
  status: IncidentStatus;
  createdAt: DateString;
  updatedAt: DateString;
  reportedBy?: Pick<Usuario, "id" | "nome" | "telefone"> | null;
  reportedUser?: Pick<Usuario, "id" | "nome" | "telefone"> | null;
};

// Sincronizar com schema.prisma se o modelo mudar
export type IncidentAttachment = {
  id: string;
  incidentId: string;
  key: string;
  mime: string;
  size: number;
  createdAt: DateString;
};
