export type ServicoStatus =
  | "RASCUNHO"
  | "SOLICITADO"
  | "ACEITO"
  | "RECUSADO"
  | "CANCELADO"
  | "EM_ANDAMENTO"
  | "CONCLUIDO"
  | "CONCLUÍDO"
  | "CONFIRMADO"
  | "FINALIZADO";

export type ServicoTipo = "FAXINA" | "BABA" | "COZINHEIRA" | "PASSA_ROUPA";

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
  | "PASSA_ROUPA_COMPLETO";

export type Servico = {
  createdAt: string | number | Date;
  id: string;
  status: ServicoStatus;
  tipo: ServicoTipo;
  categoria?: ServicoCategoria | null;
  data: string;
  turno: "MANHA" | "TARDE";
  cidade: string;
  uf: string;
  bairro: string;
  precoFinal: number;
  latitude?: number | null;
  longitude?: number | null;

  temPet: boolean;
  quartos3Mais: boolean;
  banheiros2Mais: boolean;
  observacoes?: string | null;

  enderecoCompleto?: string | null;

  cliente: { id: string; nome: string; telefone: string; name?: string; fullName?: string };
  diarista: { id: string; nome: string; telefone: string; name?: string; fullName?: string };
  securityLevel?: "NORMAL" | "REFORCADO";
  riskTier?: number;
  clienteVerificacao?: "NAO_ENVIADO" | "PENDENTE" | "APROVADO" | "REPROVADO";
};

export type MinhasResponse = { ok: boolean; servicos: Servico[] };

export type CriarServicoPayload = {
  tipo: ServicoTipo;
  categoria?: ServicoCategoria;
  dataISO: string;
  turno: "MANHA" | "TARDE";
  cidade: string;
  uf: string;
  bairro: string;
  diaristaUserId: string;
  latitude?: number;
  longitude?: number;
  enderecoCompleto?: string;
  temPet?: boolean;
  quartos3Mais?: boolean;
  banheiros2Mais?: boolean;
  observacoes?: string;
};

export type CriarServicoResponse = { ok: boolean; servicoId: string };
