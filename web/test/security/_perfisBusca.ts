// Linhas de perfil no formato que as buscas recebem do Prisma: completas,
// verificadas e em "Agua Boa/MT", para que só o score decida se aparecem.

export function montadorDaBusca(
  userId: string,
  safeScoreProfile: { currentScore: number; tier: string } | null,
) {
  return {
    id: `mp-${userId}`,
    userId,
    bio: "Monto móveis planejados",
    especialidades: ["montagem"],
    anosExperiencia: 3,
    cidade: "Agua Boa",
    estado: "MT",
    bairros: ["Centro"],
    atendeTodaCidade: true,
    raioAtendimentoKm: null,
    fotoPerfil: null,
    portfolioFotos: [],
    precoBase: null,
    taxaMinima: null,
    cobraDeslocamento: false,
    observacaoPreco: null,
    valorACombinar: true,
    precosEspecialidades: null,
    verificado: true,
    ativo: true,
    rating: 5,
    totalServicos: 0,
    user: {
      id: userId,
      nome: "Montador Teste",
      genero: null,
      status: "ATIVO",
      avatarUrl: null,
      safeScoreProfile,
    },
  };
}

export function diaristaDaBusca(userId: string) {
  return {
    id: `dp-${userId}`,
    userId,
    bio: "Faço faxina completa",
    fotoUrl: null,
    verificacao: "VERIFICADO",
    ativo: true,
    precoLeve: 10000,
    precoMedio: 0,
    precoPesada: 15000,
    notaMedia: 5,
    totalServicos: 0,
    servicosOferecidos: ["DIARISTA"],
    cidade: "Agua Boa",
    estado: "MT",
    latitude: null,
    longitude: null,
    atendeTodaCidade: true,
    raioAtendimentoKm: null,
    precoBabaHora: null,
    precoCozinheiraBase: null,
    taxaMinima: null,
    valorACombinar: false,
    bairros: [],
    user: { id: userId, nome: "Diarista Teste", status: "ATIVO", avatarUrl: null },
  };
}

export const URL_BUSCA = "cidade=Agua%20Boa&uf=MT";
