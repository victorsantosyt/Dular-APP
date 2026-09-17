import { prisma } from "@/lib/prisma";
import {
  SERVICOS_OFERECIDOS_VALIDOS,
  getDiaristaProfileCompleteness,
  nichoFromTipo,
  type ServicoOferecido,
} from "@/lib/diaristaProfile";
import { getMontadorProfileCompleteness } from "@/lib/montadorProfile";

/**
 * Identidade de papel e de nicho para o painel.
 *
 * Este é um eixo SEPARADO da escala de prioridade (design-system/ui/priority.ts).
 * Lá a cor significa urgência; aqui significa quem a pessoa é. Reaproveitar
 * `Tone` faria o roxo do Empregador passar a dizer "prioridade média" — por isso
 * a cor vai como hex, e não como tom.
 *
 * Os hex NÃO foram escolhidos aqui. Vêm do app, para o painel falar a mesma
 * língua visual de quem usa o produto:
 *   papéis — dular-mobile/src/screens/onboarding/RoleSelectScreen.tsx (l. 38-40)
 *   nichos — dular-mobile/src/constants/categorias.ts (campo `fg`)
 *
 * O nicho vive em `DiaristaProfile.servicosOferecidos` (String[]), gravado pelo
 * app no PATCH /api/diarista/me. É a MESMA lista que a busca do empregador
 * filtra, então contar por aqui conta o que de fato decide quem aparece.
 * `DiaristaHabilidade` existe em paralelo, com outro vocabulário e sem
 * LAVADEIRA/CUIDADORA — não serve como fonte e não é lida aqui.
 */

export type Identidade = {
  /** Nome curto, para linha de tabela e etiqueta. */
  rotulo: string;
  /** Nome do cartão, como o app o chama na escolha de perfil. */
  rotuloCartao: string;
  /** Hex de identidade, aplicado por estilo inline (não é token do tema). */
  cor: string;
  descricao: string;
};

/**
 * O papel continua sendo DIARISTA no banco — decisão registrada em
 * lib/diaristaProfile.ts ("NÃO criamos UserRole.PROFISSIONAL_CASA"). O que muda
 * é só como o painel o chama, para bater com o app: o perfil guarda babá,
 * cozinheira, cuidadora, passadeira e lavadeira, e "Diarista" elegia uma delas.
 */
export const PAPEL: Record<string, Identidade> = {
  EMPREGADOR: {
    rotulo: "Empregador",
    rotuloCartao: "Sou Empregador",
    cor: "#7B5CFA",
    descricao: "Contrata profissionais",
  },
  DIARISTA: {
    rotulo: "Profissional",
    rotuloCartao: "Sou Profissional",
    cor: "#F7658B",
    descricao: "Diarista, babá, cozinheira, cuidadora, passadeira e lavadeira",
  },
  MONTADOR: {
    rotulo: "Montador",
    rotuloCartao: "Sou Montador",
    cor: "#4FA38F",
    descricao: "Montagem e reparos",
  },
  ADMIN: {
    rotulo: "Administrador",
    rotuloCartao: "Administrador",
    cor: "#6D7C77",
    descricao: "Acesso ao painel",
  },
};

export type IdentidadeDeNicho = Identidade & {
  /**
   * Nicho em que o trabalho acontece junto do contratante, dentro da casa e
   * sem terceiros por perto. Não é juízo sobre a atividade: é onde o suporte
   * precisa chegar primeiro quando algo dá errado.
   */
  contatoDireto: boolean;
};

export const NICHO: Record<ServicoOferecido, IdentidadeDeNicho> = {
  DIARISTA: {
    rotulo: "Diarista",
    rotuloCartao: "Diarista",
    cor: "#F7658B",
    descricao: "Limpeza e organização",
    contatoDireto: true,
  },
  BABA: {
    rotulo: "Babá",
    rotuloCartao: "Babá",
    cor: "#7B5CFA",
    descricao: "Cuidados com crianças",
    contatoDireto: true,
  },
  COZINHEIRA: {
    rotulo: "Cozinheira",
    rotuloCartao: "Cozinheira",
    cor: "#F47A1F",
    descricao: "Preparo de refeições",
    contatoDireto: false,
  },
  PASSADEIRA: {
    rotulo: "Passadeira",
    rotuloCartao: "Passadeira",
    cor: "#5566E0",
    descricao: "Passar roupa",
    contatoDireto: true,
  },
  LAVADEIRA: {
    rotulo: "Lavadeira",
    rotuloCartao: "Lavadeira",
    cor: "#1AA6B7",
    descricao: "Lavar roupa",
    contatoDireto: true,
  },
  CUIDADORA: {
    rotulo: "Cuidadora",
    rotuloCartao: "Cuidadora",
    cor: "#2BA15F",
    descricao: "Cuidados a idosos e pessoas",
    // Dentro da casa, com pessoa idosa ou dependente e quase sempre sem mais
    // ninguém por perto — é o nicho mais exposto dos seis, não o menos.
    contatoDireto: true,
  },
};

/**
 * O que ainda impede este perfil de aparecer na busca.
 *
 * A busca (api/diaristas/buscar) exige VERIFICADO **e** perfil completo, e
 * descarta o incompleto em silêncio — a lista de rejeitados só existe como
 * console.log em desenvolvimento. Esta função traz essa mesma regra para onde
 * dá para agir sobre ela: a aprovação do KYC e o painel.
 *
 * Usa as mesmas funções que a busca usa. Reimplementar a conta aqui garantiria
 * que as duas divergissem, e aí o painel passaria a prometer uma visibilidade
 * que o produto não entrega — que é exatamente o problema que isto resolve.
 */
export type PendenciaDeVisibilidade = {
  /** false = está aprovado e mesmo assim não aparece para ninguém. */
  visivel: boolean;
  /**
   * Motivos crus. Atenção: o vocabulário difere por papel — o da profissional
   * são slugs (`falta_bio`), o do montador são frases (`sem bio`). Quem exibe
   * decide como rotular; ver `rotuloDoMotivo`.
   */
  motivos: string[];
};

const SELECT_PERFIL_DIARISTA = {
  ativo: true,
  bio: true,
  servicosOferecidos: true,
  cidade: true,
  estado: true,
  atendeTodaCidade: true,
  raioAtendimentoKm: true,
  precoLeve: true,
  precoMedio: true,
  precoPesada: true,
  precoBabaHora: true,
  precoCozinheiraBase: true,
  taxaMinima: true,
  valorACombinar: true,
  verificacao: true,
  bairros: { select: { id: true } },
  user: { select: { nome: true, status: true } },
} as const;

export async function pendenciasDeVisibilidade(
  userId: string,
  role: string,
): Promise<PendenciaDeVisibilidade> {
  if (role === "DIARISTA") {
    const perfil = await prisma.diaristaProfile.findUnique({
      where: { userId },
      select: SELECT_PERFIL_DIARISTA,
    });
    if (!perfil) return { visivel: false, motivos: ["sem_perfil_diarista"] };
    const { completo, motivos } = getDiaristaProfileCompleteness(perfil);
    return { visivel: completo, motivos };
  }

  if (role === "MONTADOR") {
    const perfil = await prisma.montadorPerfil.findUnique({
      where: { userId },
      select: {
        bio: true,
        especialidades: true,
        cidade: true,
        estado: true,
        bairros: true,
        atendeTodaCidade: true,
        ativo: true,
        user: { select: { nome: true, status: true } },
      },
    });
    if (!perfil) return { visivel: false, motivos: ["sem_perfil_montador"] };
    const { completo, motivos } = getMontadorProfileCompleteness({
      nome: perfil.user?.nome,
      bio: perfil.bio,
      especialidades: perfil.especialidades,
      cidade: perfil.cidade,
      estado: perfil.estado,
      bairros: perfil.bairros,
      atendeTodaCidade: perfil.atendeTodaCidade,
      ativo: perfil.ativo,
      userStatus: perfil.user?.status,
    });
    return { visivel: completo, motivos };
  }

  // O Empregador não aparece em busca nenhuma: não há visibilidade a cobrar.
  return { visivel: true, motivos: [] };
}

export type ProfissionalInvisivel = {
  userId: string;
  nome: string | null;
  motivos: string[];
};

/**
 * Aprovados que, ainda assim, não aparecem para ninguém.
 *
 * É o estado que não tinha nome: a aprovação do KYC olha só o documento, então
 * ela concede VERIFICADO a um perfil pela metade; a busca então o descarta pela
 * completude, sem avisar ninguém. A pessoa fica cadastrada, aprovada e sem
 * receber um pedido sequer.
 */
export async function profissionaisInvisiveis(): Promise<ProfissionalInvisivel[]> {
  const perfis = await prisma.diaristaProfile.findMany({
    where: { verificacao: "VERIFICADO" },
    select: { userId: true, ...SELECT_PERFIL_DIARISTA },
  });

  const invisiveis: ProfissionalInvisivel[] = [];
  for (const perfil of perfis) {
    const { completo, motivos } = getDiaristaProfileCompleteness(perfil);
    if (completo) continue;
    invisiveis.push({ userId: perfil.userId, nome: perfil.user?.nome ?? null, motivos });
  }
  return invisiveis;
}

export type ContagemPorPapel = {
  total: number;
  empregadores: number;
  profissionais: number;
  montadores: number;
  admins: number;
  /**
   * Contas sem papel definido.
   *
   * `User.role` é anulável de propósito: o login social cria a conta e só o
   * PATCH /api/me/role grava o papel depois ("role fica null até ele escolher o
   * perfil", em lib/auth-oauth.ts). Quem fechou o app entre uma coisa e outra
   * ficou assim para sempre — nada reprocessa.
   *
   * Sem este número, essas pessoas entram no total e em nenhum dos cards de
   * papel: a soma não fecha e ninguém percebe que elas existem.
   */
  semPapel: number;
};

export async function contarPorPapel(): Promise<ContagemPorPapel> {
  const [total, porPapel] = await Promise.all([
    prisma.user.count(),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
  ]);

  const de = (role: string) =>
    porPapel.find((g) => g.role === role)?._count._all ?? 0;

  const empregadores = de("EMPREGADOR");
  const profissionais = de("DIARISTA");
  const montadores = de("MONTADOR");
  const admins = de("ADMIN");

  return {
    total,
    empregadores,
    profissionais,
    montadores,
    admins,
    // Diferença em vez de `count({ role: null })`: assim o número cobre também
    // qualquer papel novo que entre no enum e que esta função ainda não conte —
    // o card acusa a discrepância em vez de ela sumir na soma.
    semPapel: Math.max(0, total - empregadores - profissionais - montadores - admins),
  };
}

export type NichoNoPainel = {
  nicho: ServicoOferecido;
  identidade: IdentidadeDeNicho;
  /** Profissionais que declaram atender este nicho. */
  profissionais: number;
  /** Serviços já solicitados neste nicho — a procura, não a oferta. */
  servicos: number;
};

export type ResumoDosNichos = {
  nichos: NichoNoPainel[];
  /** Todo mundo com papel de profissional, tenha perfil preenchido ou não. */
  totalProfissionais: number;
  comNicho: number;
  /**
   * Sem nenhum nicho declarado. Não é só um cadastro incompleto: a busca do
   * empregador filtra por `servicosOferecidos`, então quem está aqui não
   * aparece para ninguém.
   */
  semNicho: number;
  /** Pessoas com ao menos um nicho de contato direto. */
  emContatoDireto: number;
  /**
   * Soma das declarações. Maior que `comNicho` porque a escolha é múltipla —
   * uma pessoa pode ser babá e cozinheira ao mesmo tempo.
   */
  declaracoes: number;
};

export async function resumoDosNichos(): Promise<ResumoDosNichos> {
  const [perfis, totalProfissionais, porTipo] = await Promise.all([
    prisma.diaristaProfile.findMany({ select: { servicosOferecidos: true } }),
    prisma.user.count({ where: { role: "DIARISTA" } }),
    prisma.servico.groupBy({ by: ["tipo"], _count: { _all: true } }),
  ]);

  const ofertaPorNicho = new Map<ServicoOferecido, number>();
  let comNicho = 0;
  let declaracoes = 0;
  let emContatoDireto = 0;

  for (const perfil of perfis) {
    // Valor fora da lista canônica é ignorado em vez de virar uma coluna nova:
    // a tela mostraria um nicho que o app não oferece.
    const declarados = perfil.servicosOferecidos.filter((s): s is ServicoOferecido =>
      (SERVICOS_OFERECIDOS_VALIDOS as string[]).includes(s),
    );
    if (declarados.length === 0) continue;

    comNicho += 1;
    declaracoes += declarados.length;
    if (declarados.some((n) => NICHO[n].contatoDireto)) emContatoDireto += 1;

    for (const n of declarados) {
      ofertaPorNicho.set(n, (ofertaPorNicho.get(n) ?? 0) + 1);
    }
  }

  // Vários tipos de serviço caem no mesmo nicho (as três faixas de faxina, por
  // exemplo). MONTADOR devolve null: tem fluxo próprio e não é nicho daqui.
  const procuraPorNicho = new Map<ServicoOferecido, number>();
  for (const grupo of porTipo) {
    const nicho = nichoFromTipo(grupo.tipo);
    if (!nicho) continue;
    procuraPorNicho.set(nicho, (procuraPorNicho.get(nicho) ?? 0) + grupo._count._all);
  }

  return {
    nichos: SERVICOS_OFERECIDOS_VALIDOS.map((nicho) => ({
      nicho,
      identidade: NICHO[nicho],
      profissionais: ofertaPorNicho.get(nicho) ?? 0,
      servicos: procuraPorNicho.get(nicho) ?? 0,
    })),
    totalProfissionais,
    comNicho,
    // Quem não tem sequer DiaristaProfile entra aqui, e deve mesmo: para a
    // busca, não ter perfil e não declarar nicho dão no mesmo.
    semNicho: Math.max(0, totalProfissionais - comNicho),
    emContatoDireto,
    declaracoes,
  };
}
