import { prisma } from "@/lib/prisma";
import type { FeedbackTipo } from "@prisma/client";

/**
 * Leitura do feedback sobre o app, para o painel.
 *
 * Existe separado de `adminVerificacoes`/`Avaliacao` porque é outra coisa: a
 * tela de Feedbacks do painel lê `Avaliacao`, que é nota de SERVIÇO — a pessoa
 * avaliando quem foi à casa dela. Aqui é a opinião sobre o produto. Juntar as
 * duas numa lista só faria "a diarista atrasou" e "o app trava no pagamento"
 * disputarem a mesma fila.
 */

export const ROTULO_DO_TIPO: Record<FeedbackTipo, string> = {
  SUGESTAO: "Sugestão",
  PROBLEMA: "Problema",
  ELOGIO: "Elogio",
  OUTRO: "Outro",
};

export type LinhaDeFeedback = {
  id: string;
  tipo: FeedbackTipo;
  nota: number | null;
  mensagem: string;
  origem: string | null;
  appVersao: string | null;
  plataforma: string | null;
  lido: boolean;
  createdAt: Date;
  autor: { nome: string; papel: string | null };
};

export type PaginaDeFeedback = {
  linhas: LinhaDeFeedback[];
  total: number;
  pagina: number;
  totalPaginas: number;
};

export type IndicadoresDeFeedback = {
  total: number;
  naoLidos: number;
  problemas: number;
  /** Últimos 7 dias — mostra se a fila está crescendo ou parada. */
  ultimos7Dias: number;
};

const POR_PAGINA = 25;

export async function indicadoresDeFeedback(): Promise<IndicadoresDeFeedback> {
  const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [total, naoLidos, problemas, ultimos7Dias] = await Promise.all([
    prisma.feedback.count(),
    prisma.feedback.count({ where: { lidoEm: null } }),
    prisma.feedback.count({ where: { tipo: "PROBLEMA" } }),
    prisma.feedback.count({ where: { createdAt: { gte: seteDiasAtras } } }),
  ]);

  return { total, naoLidos, problemas, ultimos7Dias };
}

export async function listarFeedback(filtro: {
  tipo?: FeedbackTipo;
  pagina?: number;
}): Promise<PaginaDeFeedback> {
  const pagina = Math.max(1, filtro.pagina ?? 1);
  const where = filtro.tipo ? { tipo: filtro.tipo } : {};

  const [total, rows] = await Promise.all([
    prisma.feedback.count({ where }),
    prisma.feedback.findMany({
      where,
      // Não lidos primeiro, e dentro deles o mais recente: a fila de quem
      // precisa de resposta fica no topo sem exigir filtro.
      orderBy: [{ lidoEm: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      select: {
        id: true,
        tipo: true,
        nota: true,
        mensagem: true,
        origem: true,
        appVersao: true,
        plataforma: true,
        lidoEm: true,
        createdAt: true,
        user: { select: { nome: true, role: true } },
      },
    }),
  ]);

  return {
    linhas: rows.map((r) => ({
      id: r.id,
      tipo: r.tipo,
      nota: r.nota,
      mensagem: r.mensagem,
      origem: r.origem,
      appVersao: r.appVersao,
      plataforma: r.plataforma,
      lido: r.lidoEm !== null,
      createdAt: r.createdAt,
      autor: { nome: r.user?.nome ?? "—", papel: r.user?.role ?? null },
    })),
    total,
    pagina,
    totalPaginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
  };
}
