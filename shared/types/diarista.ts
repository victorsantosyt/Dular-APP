import type { DateString, VerificacaoStatus } from "./common";
import type { ServicoCategoria, ServicoTipo } from "./servico";
import type { Usuario } from "./usuario";

// Sincronizar com schema.prisma se o modelo mudar
export type Diarista = {
  id: string;
  userId: string;
  verificacao: VerificacaoStatus;
  ativo: boolean;
  fotoUrl: string | null;
  docUrl: string | null;
  bio: string | null;
  precoLeve: number;
  precoMedio: number;
  precoPesada: number;
  notaMedia: number;
  totalServicos: number;
  createdAt: DateString;
  updatedAt: DateString;
  user?: Usuario;
};

export type DiaristaHabilidade = {
  id: string;
  diaristaId: string;
  tipo: ServicoTipo;
  categoria: ServicoCategoria | null;
  createdAt: DateString;
};

export type DiaristaItem = Pick<
  Diarista,
  "id" | "verificacao" | "precoLeve" | "precoMedio" | "precoPesada" | "notaMedia" | "totalServicos" | "bio"
> & {
  user: Pick<Usuario, "id" | "nome" | "telefone">;
};

export type BuscarDiaristasResponse = {
  ok: boolean;
  diaristas: DiaristaItem[];
};
