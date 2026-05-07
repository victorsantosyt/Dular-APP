import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import type { UserRole } from "@prisma/client";
import { z } from "zod";

// roomId = servicoId
// A sala é criada lazily na primeira visita, desde que o serviço esteja ACEITO ou posterior.

const ALLOWED_STATUSES = new Set([
  "ACEITO",
  "EM_ANDAMENTO",
  "CONCLUIDO",
  "CONFIRMADO",
  "FINALIZADO",
]);

type Params = { params: Promise<{ roomId: string }> };

const postSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  type: z.literal("TEXT").optional(),
});

export async function GET(req: Request, { params }: Params) {
  try {
    const auth = requireAuth(req);
    const { roomId: servicoId } = await params;

    const servico = await prisma.servico.findUnique({
      where: { id: servicoId },
      select: {
        id: true,
        status: true,
        clientId: true,
        diaristaId: true,
        tipo: true,
        data: true,
        turno: true,
        bairro: true,
        cidade: true,
        uf: true,
      },
    });

    if (!servico) {
      return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });
    }

    const isParticipant =
      servico.clientId === auth.userId || servico.diaristaId === auth.userId;

    if (!isParticipant) {
      return NextResponse.json({ ok: false, error: "Acesso negado." }, { status: 403 });
    }

    if (!ALLOWED_STATUSES.has(servico.status)) {
      return NextResponse.json(
        { ok: false, error: "Chat disponível apenas após aceite do serviço." },
        { status: 403 },
      );
    }

    const room = await prisma.chatRoom.upsert({
      where: { servicoId },
      update: {},
      create: { servicoId },
      select: {
        id: true,
        servicoId: true,
        createdAt: true,
        _count: { select: { messages: true } },
      },
    });

    const otherUserId =
      auth.userId === servico.clientId ? servico.diaristaId : servico.clientId;

    const otherUser = await prisma.user.findUnique({
      where: { id: otherUserId },
      select: { id: true, nome: true, avatarUrl: true, role: true },
    });

    const messages = await prisma.chatMessage.findMany({
      where: { roomId: room.id },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: {
        id: true,
        roomId: true,
        type: true,
        content: true,
        senderId: true,
        readAt: true,
        createdAt: true,
        sender: { select: { id: true, nome: true, avatarUrl: true } },
      },
    });

    const unreadIds = messages
      .filter((m) => m.senderId === otherUserId && m.readAt === null)
      .map((m) => m.id);

    if (unreadIds.length > 0) {
      await prisma.chatMessage.updateMany({
        where: { id: { in: unreadIds } },
        data: { readAt: new Date() },
      });
    }

    return NextResponse.json({
      ok: true,
      room: {
        id: room.id,
        servicoId: room.servicoId,
        createdAt: room.createdAt,
        totalMessages: room._count.messages,
        servico: {
          id: servico.id,
          status: servico.status,
          tipo: servico.tipo,
          data: servico.data,
          turno: servico.turno,
          local: `${servico.bairro}, ${servico.cidade} - ${servico.uf}`,
        },
        other: otherUser,
        myRole: auth.role as UserRole,
      },
      messages,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const auth = requireAuth(req);
    const { roomId: servicoId } = await params;

    const servico = await prisma.servico.findUnique({
      where: { id: servicoId },
      select: {
        status: true,
        clientId: true,
        diaristaId: true,
      },
    });

    if (!servico) {
      return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });
    }

    const isParticipant =
      servico.clientId === auth.userId || servico.diaristaId === auth.userId;

    if (!isParticipant) {
      return NextResponse.json({ ok: false, error: "Acesso negado." }, { status: 403 });
    }

    if (!ALLOWED_STATUSES.has(servico.status)) {
      return NextResponse.json(
        { ok: false, error: "Chat disponível apenas após aceite do serviço." },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0].message }, { status: 400 });
    }

    const room = await prisma.chatRoom.upsert({
      where: { servicoId },
      update: {},
      create: { servicoId },
      select: { id: true },
    });

    const message = await prisma.chatMessage.create({
      data: {
        roomId: room.id,
        senderId: auth.userId,
        type: "TEXT",
        content: parsed.data.content,
      },
      select: {
        id: true,
        roomId: true,
        type: true,
        content: true,
        senderId: true,
        readAt: true,
        createdAt: true,
        sender: { select: { id: true, nome: true, avatarUrl: true } },
      },
    });

    return NextResponse.json({ ok: true, message }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}
