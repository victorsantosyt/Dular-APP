import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { z } from "zod";

const ALLOWED_STATUSES = new Set([
  "ACEITO",
  "EM_ANDAMENTO",
  "CONCLUIDO",
  "CONFIRMADO",
  "FINALIZADO",
]);

const PAGE_SIZE = 50;

const postSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("TEXT"),
    content: z.string().min(1).max(2000),
  }),
  z.object({
    type: z.literal("IMAGE"),
    content: z.string().min(1), // URL ou S3 key
  }),
  z.object({
    type: z.literal("LOCATION"),
    content: z.string().refine((v) => {
      try {
        const p = JSON.parse(v);
        return typeof p.lat === "number" && typeof p.lng === "number";
      } catch {
        return false;
      }
    }, "Localização inválida. Esperado JSON {lat, lng}"),
  }),
]);

type Params = { params: Promise<{ roomId: string }> };

// ─── helpers ────────────────────────────────────────────────────────────────

async function resolveRoom(servicoId: string, userId: string) {
  const servico = await prisma.servico.findUnique({
    where: { id: servicoId },
    select: { status: true, clientId: true, diaristaId: true },
  });

  if (!servico) return { error: "Serviço não encontrado.", status: 404 } as const;

  const isParticipant =
    servico.clientId === userId || servico.diaristaId === userId;
  if (!isParticipant) return { error: "Acesso negado.", status: 403 } as const;

  if (!ALLOWED_STATUSES.has(servico.status)) {
    return {
      error: "Chat disponível apenas após aceite do serviço.",
      status: 403,
    } as const;
  }

  const room = await prisma.chatRoom.upsert({
    where: { servicoId },
    update: {},
    create: { servicoId },
    select: { id: true },
  });

  return { room, servico } as const;
}

// ─── GET /api/chat/[roomId]/messages ────────────────────────────────────────

export async function GET(req: Request, { params }: Params) {
  try {
    const auth = requireAuth(req);
    const { roomId: servicoId } = await params;

    const resolved = await resolveRoom(servicoId, auth.userId);
    if ("error" in resolved) {
      return NextResponse.json({ ok: false, error: resolved.error }, { status: resolved.status });
    }

    const { room, servico } = resolved;
    const url = new URL(req.url);

    // ?before=<messageId>  — carrega mensagens anteriores (scroll infinito)
    const before = url.searchParams.get("before") ?? undefined;

    const messages = await prisma.chatMessage.findMany({
      where: {
        roomId: room.id,
        ...(before ? { id: { lt: before } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      select: {
        id: true,
        type: true,
        content: true,
        senderId: true,
        readAt: true,
        createdAt: true,
        sender: { select: { id: true, nome: true, avatarUrl: true } },
      },
    });

    // Marca como lidas as mensagens do outro participante que ainda não foram lidas
    const otherUserId =
      auth.userId === servico.clientId ? servico.diaristaId : servico.clientId;

    const unreadIds = messages
      .filter((m) => m.senderId === otherUserId && m.readAt === null)
      .map((m) => m.id);

    if (unreadIds.length > 0) {
      await prisma.chatMessage.updateMany({
        where: { id: { in: unreadIds } },
        data: { readAt: new Date() },
      });

      // Reflete o readAt nas mensagens já carregadas (sem nova query)
      const now = new Date();
      for (const m of messages) {
        if (unreadIds.includes(m.id)) m.readAt = now;
      }
    }

    return NextResponse.json({
      ok: true,
      messages: messages.reverse(), // cronológico (mais antigo primeiro)
      pagination: {
        hasMore: messages.length === PAGE_SIZE,
        nextCursor: messages.length > 0 ? messages[0].id : null,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}

// ─── POST /api/chat/[roomId]/messages ───────────────────────────────────────

export async function POST(req: Request, { params }: Params) {
  try {
    const auth = requireAuth(req);
    const { roomId: servicoId } = await params;

    const resolved = await resolveRoom(servicoId, auth.userId);
    if ("error" in resolved) {
      return NextResponse.json({ ok: false, error: resolved.error }, { status: resolved.status });
    }

    const { room } = resolved;

    const body = await req.json().catch(() => null);
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const message = await prisma.chatMessage.create({
      data: {
        roomId: room.id,
        senderId: auth.userId,
        type: parsed.data.type,
        content: parsed.data.content,
      },
      select: {
        id: true,
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
