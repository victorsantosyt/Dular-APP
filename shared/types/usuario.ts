import type { DateString, UserRole, UserStatus } from "./common";

// Sincronizar com schema.prisma se o modelo mudar
export type Usuario = {
  id: string;
  nome: string;
  telefone: string | null;
  cpf: string | null;
  dataNascimento: DateString | null;
  email: string | null;
  senhaHash?: string | null;
  role: UserRole | null;
  status: UserStatus;
  riskScore: number;
  riskTier: number;
  emObservacao: boolean;
  avatarUrl: string | null;
  pushToken: string | null;
  createdAt: DateString;
  updatedAt: DateString;
};
