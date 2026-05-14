/**
 * Tipos compartilhados pro lado Empregador buscando/contratando Montadores.
 * Espelha o envelope retornado por GET /api/montadores/buscar.
 */
export type MontadorItem = {
  id: string;
  userId: string;
  bio?: string | null;
  especialidades: string[];
  anosExperiencia?: number | null;
  cidade?: string | null;
  estado?: string | null;
  bairros?: string[];
  raioAtendimentoKm?: number | null;
  fotoPerfil?: string | null;
  portfolioFotos?: string[];
  precoBase?: number | null;
  taxaMinima?: number | null;
  cobraDeslocamento?: boolean;
  observacaoPreco?: string | null;
  valorACombinar?: boolean;
  precoLabel?: string;
  verificado: boolean;
  ativo?: boolean;
  rating: number;
  totalServicos: number;
  profileCompleto?: boolean;
  profileProgresso?: number;
  safeScore?: {
    score?: number;
    faixa?: string;
    cor?: string;
    bloqueado?: boolean;
    tier?: string;
    totalServicos?: number;
    verificado?: boolean;
  } | null;
  user: {
    id: string;
    nome: string;
    telefone?: string | null;
    genero?: "MASCULINO" | "FEMININO" | null;
    status?: string;
    avatarUrl?: string | null;
  };
};

export type BuscarMontadoresResponse = {
  ok: boolean;
  montadores: MontadorItem[];
};

/**
 * Especialidades mostradas ao Empregador na seleção / chips de filtro.
 * `id` é o valor enviado para o backend como `especialidade`; `label` é o
 * texto exibido.
 */
export const MONTADOR_ESPECIALIDADES = [
  { id: "montagem", label: "Montagem de móveis" },
  { id: "reparos", label: "Pequenos reparos" },
  { id: "eletrica", label: "Instalação elétrica" },
  { id: "hidraulica", label: "Instalação hidráulica" },
  { id: "pintura", label: "Pintura" },
  { id: "carpintaria", label: "Carpintaria" },
] as const;

export type MontadorEspecialidadeId = (typeof MONTADOR_ESPECIALIDADES)[number]["id"];
