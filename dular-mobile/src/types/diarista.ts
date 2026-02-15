export type DiaristaItem = {
  id: string; // diaristaProfile.id
  verificacao: "PENDENTE" | "VERIFICADO" | "REPROVADO";
  precoLeve: number;
  precoPesada: number;
  notaMedia: number;
  totalServicos: number;
  bio?: string | null;
  user: { id: string; nome: string; telefone: string };
};

export type BuscarDiaristasResponse = {
  ok: boolean;
  diaristas: DiaristaItem[];
};
