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
            in: ["ACEITO", "EM_ANDAMENTO", "CONCLUIDO", "CONFIRMADO", "FINALIZADO"],
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

    const payload = rooms.map((r) => {
      const servico = r.servico;
      const profissionalUserId = servico.montadorId ?? servico.diaristaId;
      const isCliente = servico.clientId === auth.userId;
      const outroUsuarioId = isCliente ? profissionalUserId : servico.clientId;
      const outroUsuario = isCliente
        ? servico.montador ?? servico.diarista
        : servico.cliente;

      return {
        id: r.id,
        servicoId: r.servicoId,
        createdAt: r.createdAt,
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
