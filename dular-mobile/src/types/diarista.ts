export type ServicoOferecido =
  | "DIARISTA"
  | "BABA"
  | "COZINHEIRA"
  | "PASSADEIRA"
  | "LAVADEIRA"
  | "CUIDADORA";

export type DiaristaItem = {
  id: string; // diaristaProfile.id
  verificacao: "PENDENTE" | "VERIFICADO" | "REPROVADO";
  precoLeve: number;
  precoPesada: number;
  notaMedia: number;
  totalServicos: number;
  bio?: string | null;
  servicosOferecidos?: ServicoOferecido[];
  // Coords da profissional — usados só na ordenação por proximidade (M5).
  latitude?: number | null;
  longitude?: number | null;
  user: { id: string; nome: string; telefone: string };
};

export type BuscarDiaristasResponse = {
  ok: boolean;
  diaristas: DiaristaItem[];
};
