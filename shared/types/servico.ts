import type { DateString, Turno, UserRole } from "./common";
import type { Usuario } from "./usuario";

export type ServicoStatus =
  | "RASCUNHO"
  | "SOLICITADO"
  | "ACEITO"
  | "RECUSADO"
  | "CANCELADO"
  | "EM_ANDAMENTO"
  | "CONCLUIDO"
  | "CONFIRMADO"
  | "FINALIZADO";

export type ServicoTipo = "FAXINA" | "BABA" | "COZINHEIRA" | "PASSA_ROUPA" | "MONTADOR";

export type ServicoCategoria =
  | "FAXINA_LEVE"
  | "FAXINA_PESADA"
  | "FAXINA_COMPLETA"
  | "BABA_DIURNA"
  | "BABA_NOTURNA"
  | "BABA_INTEGRAL"
  | "COZINHEIRA_DIARIA"
  | "COZINHEIRA_EVENTO"
  | "PASSA_ROUPA_BASICO"
  | "PASSA_ROUPA_COMPLETO"
  | "MONTADOR_MONTAGEM"
  | "MONTADOR_REPAROS"
  | "MONTADOR_ELETRICA"
  | "MONTADOR_HIDRAULICA"
  | "MONTADOR_PINTURA"
  | "MONTADOR_CARPINTARIA";

// Sincronizar com schema.prisma se o modelo mudar
export type Servico = {
  id: string;
  status: ServicoStatus;
  tipo: ServicoTipo;
  categoria: ServicoCategoria | null;
  data: DateString;
  turno: Turno;
  cidade: string;
  uf: string;
  bairro: string;
  enderecoCompleto: string | null;
  observacoes: string | null;
  temPet: boolean;
  quartos3Mais: boolean;
  banheiros2Mais: boolean;
  precoFinal: number;
  clientId: string;
  diaristaId: string | null;
  montadorId?: string | null;
  createdAt: DateString;
  updatedAt: DateString;
  cliente?: Pick<Usuario, "id" | "nome" | "telefone" | "avatarUrl"> | null;
  diarista?: Pick<Usuario, "id" | "nome" | "telefone" | "avatarUrl"> | null;
  montador?: Pick<Usuario, "id" | "nome" | "telefone" | "avatarUrl"> | null;
};

// Sincronizar com schema.prisma se o modelo mudar
export type ServicoEvento = {
  id: string;
  servicoId: string;
  fromStatus: ServicoStatus;
  toStatus: ServicoStatus;
  actorRole: UserRole;
  actorId: string;
  createdAt: DateString;
};

export type ServicoListItem = Servico & {
  securityLevel?: "NORMAL" | "REFORCADO";
  riskTier?: number;
};

export type MinhasResponse = { ok: boolean; servicos: ServicoListItem[] };

export type CriarServicoPayload = {
  tipo: ServicoTipo;
  categoria?: ServicoCategoria;
  dataISO: string;
  turno: Turno;
  cidade: string;
  uf: string;
  bairro: string;
  diaristaUserId?: string;
  montadorUserId?: string;
  enderecoCompleto?: string;
  temPet?: boolean;
  quartos3Mais?: boolean;
  banheiros2Mais?: boolean;
  observacoes?: string;
};

export type CriarServicoResponse = { ok: boolean; servicoId: string };
