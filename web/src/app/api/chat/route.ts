import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export const dynamic = "force-dynamic";

// GET /api/chat — Lista de salas de chat do usuário autenticado.
//
// Hotfix T-13: O mobile (useMensagens) antes fazia polling neste endpoint
// que não existia, gerando 404 em loop. O mobile foi corrigido para
// retornar []  enquanto este endpoint não existia. Esta implementação
// devolve as salas reais de forma controlada e barata (única query
// com `select` específico), evitando re-introduzir o loop de 404.
//
// Retorno: { ok: true, rooms: ChatRoom[] }
export async function GET(req: Request) {
  try {
    const auth = requireAuth(req);

    const rooms = await prisma.chatRoom.findMany({
      where: {
        servico: {
          OR: [
            { clientId: auth.userId },
            { diaristaId: auth.userId },
            { montadorId: auth.userId },
          ],
          status: {
            // ACEITO, EM_ANDAMENTO, AGUARDANDO_FINALIZACAO → chat ativo
            // CONCLUIDO, CONFIRMADO, FINALIZADO            → chat arquivado (somente leitura)
            // CANCELADO, RECUSADO, RASCUNHO, SOLICITADO    → não aparece
            in: [
              "ACEITO",
              "EM_ANDAMENTO",
              "AGUARDANDO_FINALIZACAO",
              "CONCLUIDO",
              "CONFIRMADO",
              "FINALIZADO",
            ],
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        servicoId: true,
        createdAt: true,
        servico: {
          select: {
            id: true,
            status: true,
            tipo: true,
            data: true,
            bairro: true,
            cidade: true,
            uf: true,
            clientId: true,
            diaristaId: true,
            montadorId: true,
            cliente: { select: { id: true, nome: true, avatarUrl: true } },
            diarista: { select: { id: true, nome: true, avatarUrl: true } },
            montador: { select: { id: true, nome: true, avatarUrl: true } },
          },
        },
      },
    });

    // Status terminais = chat arquivado (somente leitura). Quando ambos os
    // lados confirmam a finalização, o status vai para CONCLUIDO e o chat
    // some da aba "Conversas" e aparece em "Arquivadas".
    const ARQUIVADOS = new Set(["CONCLUIDO", "CONFIRMADO", "FINALIZADO"]);

    // Agregados de chat (evitam N+1):
    //  - naoLidasPorSala: 1 groupBy sobre ChatMessage filtrando readAt=null
    //    e senderId != userId. Usado pelo badge da aba Mensagens / card.
    //  - ultimaMsgPorSala: 1 findMany com distinct:['roomId'] + orderBy desc
    //    devolve a última mensagem de cada sala (prévia + atualizadaEm).
    const roomIds = rooms.map((r) => r.id);
    const [naoLidasGroups, ultimasMsgs] = roomIds.length === 0
      ? ([[], []] as const)
      : await Promise.all([
          prisma.chatMessage.groupBy({
            by: ["roomId"],
            where: {
              roomId: { in: roomIds },
              senderId: { not: auth.userId },
              readAt: null,
            },
            _count: { _all: true },
          }),
          prisma.chatMessage.findMany({
            where: { roomId: { in: roomIds } },
            distinct: ["roomId"],
            orderBy: { createdAt: "desc" },
            select: {
              roomId: true,
              content: true,
              createdAt: true,
              senderId: true,
              type: true,
            },
          }),
        ]);

    const naoLidasMap = new Map<string, number>(
      naoLidasGroups.map((g) => [g.roomId, g._count._all]),
    );
    const ultimaMsgMap = new Map<string, (typeof ultimasMsgs)[number]>(
      ultimasMsgs.map((m) => [m.roomId, m]),
    );

    const payload = rooms.map((r) => {
      const servico = r.servico;
      const profissionalUserId = servico.montadorId ?? servico.diaristaId;
      const isCliente = servico.clientId === auth.userId;
      const outroUsuarioId = isCliente ? profissionalUserId : servico.clientId;
      const outroUsuario = isCliente
        ? servico.montador ?? servico.diarista
        : servico.cliente;

      const ultima = ultimaMsgMap.get(r.id) ?? null;
      // `atualizadaEm` reflete a última atividade real (mensagem) e cai no
      // createdAt da sala se nunca houve mensagem. O mobile usa esse valor
      // como timestamp do card.
      const atualizadaEm = ultima?.createdAt ?? r.createdAt;

      return {
        id: r.id,
        servicoId: r.servicoId,
        createdAt: r.createdAt,
        atualizadaEm,
        arquivada: ARQUIVADOS.has(servico.status),
        outroUsuario: outroUsuario
          ? {
              id: outroUsuario.id,
              nome: outroUsuario.nome,
              avatarUrl: outroUsuario.avatarUrl ?? null,
            }
          : null,
        outroUsuarioId,
        servico: {
          id: servico.id,
          status: servico.status,
          tipo: servico.tipo,
          data: servico.data,
          local: `${servico.bairro}, ${servico.cidade} - ${servico.uf}`,
        },
        naoLidas: naoLidasMap.get(r.id) ?? 0,
        ultimaMensagem: ultima
          ? {
              content: ultima.content,
              createdAt: ultima.createdAt,
              senderId: ultima.senderId,
              type: ultima.type,
            }
          : null,
      };
    });

    return NextResponse.json({ ok: true, rooms: payload });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}
