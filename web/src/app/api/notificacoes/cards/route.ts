import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAtivo, respostaDeSessao } from "@/lib/contaAtiva";
import { cardPublico, filtrar, montarCards, paginar, SELECT_ENVIO, SELECT_EVENTO, type Envio, type Filtro } from "@/lib/cardsNotificacoes";

export const dynamic = "force-dynamic";

const FILTROS = new Set<Filtro>(["todas", "nao_lidas", "lidas"]);
const LIMITE_PADRAO = 30;
const LIMITE_MAXIMO = 50;
/** Teto de eventos lidos para montar os cards (agrupamento e contagens no servidor). */
const MAX_EVENTOS = 1000;

// GET /api/notificacoes/cards?filtro=todas|nao_lidas|lidas&cursor=&limite=
//
// Lista versionada da tela de Notificações: cards agrupados e com a
// apresentação atual calculada no servidor (lib/cardsNotificacoes). A rota
// antiga (/api/notificacoes) continua igual para os apps já instalados.
// Uma consulta de eventos e uma de envios por chamada, para a página inteira.
export async function GET(req: Request) {
  try {
    const auth = await requireAuthAtivo(req);
    const url = new URL(req.url);
    const filtroBruto = url.searchParams.get("filtro") ?? "todas";
    const filtro = (FILTROS.has(filtroBruto as Filtro) ? filtroBruto : "todas") as Filtro;
    const limiteBruto = Number(url.searchParams.get("limite") ?? LIMITE_PADRAO);
    const limite = Number.isInteger(limiteBruto) && limiteBruto > 0 ? Math.min(limiteBruto, LIMITE_MAXIMO) : LIMITE_PADRAO;
    const cursor = url.searchParams.get("cursor");

    const [eventos, envios, naoLidas] = await Promise.all([
      prisma.notification.findMany({ where: { userId: auth.userId }, orderBy: { createdAt: "desc" }, take: MAX_EVENTOS, select: SELECT_EVENTO }),
      prisma.documentVerification.findMany({ where: { userId: auth.userId }, orderBy: { createdAt: "asc" }, select: SELECT_ENVIO }),
      // Mesma contagem do sino/badge de hoje: notificações (eventos) não lidas.
      prisma.notification.count({ where: { userId: auth.userId, readAt: null } }),
    ]);

    const cards = montarCards(eventos, envios as Envio[]);
    const filtrados = filtrar(cards, filtro);
    const { pagina, proximoCursor } = paginar(filtrados, cursor, limite);

    return NextResponse.json({
      ok: true,
      filtro,
      cards: pagina.map(cardPublico),
      proximoCursor,
      contadores: {
        naoLidas,
        acoesNecessarias: cards.filter((c) => c.apresentacao?.estado === "ACAO_NECESSARIA").length,
        cards: { todas: cards.length, nao_lidas: filtrar(cards, "nao_lidas").length, lidas: filtrar(cards, "lidas").length },
      },
    });
  } catch (error: unknown) {
    const sessao = respostaDeSessao(error);
    if (sessao) return sessao;
    console.error("[notificacoes/cards GET] erro interno.");
    return NextResponse.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}
