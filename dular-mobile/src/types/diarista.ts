export type ServicoOferecido = "DIARISTA" | "BABA" | "COZINHEIRA";

export type DiaristaItem = {
  id: string; // diaristaProfile.id
  verificacao: "PENDENTE" | "VERIFICADO" | "REPROVADO";
  precoLeve: number;
  precoPesada: number;
  notaMedia: number;
  totalServicos: number;
  bio?: string | null;
  servicosOferecidos?: ServicoOferecido[];
  user: { id: string; nome: string; telefone: string };
};

export type BuscarDiaristasResponse = {
  ok: boolean;
  diaristas: DiaristaItem[];
};
