import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { requireAuthAtivo, respostaDeSessao } from "@/lib/contaAtiva";
import { criarNotificacao } from "@/lib/notifications";
import { publishChatEvent, isUserPresentInRoom } from "@/lib/ably";
import { cleanupRateLimit, rateLimit, rateLimitRetryAfterMs } from "@/lib/rateLimit";
import { getRequestIp } from "@/lib/requestIp";
import {
  anterioresAo,
  MAIS_RECENTES_PRIMEIRO,
  marcarDevolvidasComoLidas,
  PAGINA_MENSAGENS,
  STATUS_COM_CHAT,
} from "@/lib/chatSala";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Mesmos status da rota principal da sala (lib/chatSala) — antes esta lista
// não tinha AGUARDANDO_FINALIZACAO e divergia da outra.
const ALLOWED_STATUSES = STATUS_COM_CHAT;

const PAGE_SIZE = PAGINA_MENSAGENS;

const postSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("TEXT"),
    content: z.string().min(1).max(2000),
  }),
  z.object({
    type: z.literal("IMAGE"),
    // Imagem = data URL base64 (mesmo padrão do avatar em me/avatar). Teto de
    // tamanho para não inchar a linha do Postgres nem o payload do GET da sala.
    content: z
      .string()
      .startsWith("data:image/", "Imagem inválida (esperado data URL de imagem).")
      .max(3_000_000, "Imagem muito grande. Reduza a qualidade e tente novamente."),
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
    select: {
      status: true,
      clientId: true,
      diaristaId: true,
      montadorId: true,
    },
  });

  if (!servico) return { error: "Serviço não encontrado.", status: 404 } as const;

  const isParticipant =
    servico.clientId === userId ||
    servico.diaristaId === userId ||
    servico.montadorId === userId;
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
    const auth = await requireAuthAtivo(req);
    const { roomId: servicoId } = await params;

    const resolved = await resolveRoom(servicoId, auth.userId);
    if ("error" in resolved) {
      return NextResponse.json({ ok: false, error: resolved.error }, { status: resolved.status });
    }

    const { room, servico } = resolved;
    const url = new URL(req.url);

    // ?before=<messageId>  — carrega mensagens anteriores (scroll infinito)
    const before = url.searchParams.get("before") ?? undefined;

    const profissionalUserId = servico.montadorId ?? servico.diaristaId;
    const otherUserId =
      auth.userId === servico.clientId ? profissionalUserId : servico.clientId;

    // Entrega (deliveredAt) ANTES de leitura (readAt): ao carregar a sala, todas
    // as mensagens do outro viram "entregues"; só as efetivamente vistas viram
    // "lidas" no bloco abaixo.
    if (otherUserId) {
      await prisma.chatMessage.updateMany({
        where: { roomId: room.id, senderId: otherUserId, deliveredAt: null },
        data: { deliveredAt: new Date() },
      });
    }

    // Cursor = id da mensagem mais antiga já exibida. A página seguinte são as
    // estritamente anteriores a ela na ordem (createdAt, id) — antes era
    // `id < before`, que compara ids (cuid) e não a data, e aceitava cursor de
    // outra sala. Cursor que não é desta sala → 400.
    let cursor: { id: string; createdAt: Date } | null = null;
    if (before) {
      cursor = await prisma.chatMessage.findFirst({
        where: { id: before, roomId: room.id },
        select: { id: true, createdAt: true },
      });
      if (!cursor) {
        return NextResponse.json({ ok: false, error: "Cursor inválido." }, { status: 400 });
      }
    }

    // Uma a mais que a página: diz, sem outra consulta, se ainda há anteriores.
    const lidas = await prisma.chatMessage.findMany({
      where: { roomId: room.id, ...(cursor ? anterioresAo(cursor) : {}) },
      orderBy: MAIS_RECENTES_PRIMEIRO,
      take: PAGE_SIZE + 1,
      select: {
        id: true,
        type: true,
        content: true,
        senderId: true,
        deliveredAt: true,
        readAt: true,
        createdAt: true,
        sender: { select: { id: true, nome: true, avatarUrl: true } },
      },
    });
    const hasMore = lidas.length > PAGE_SIZE;
    const messages = lidas.slice(0, PAGE_SIZE);

    // Lidas = as do outro participante devolvidas nesta página (lib/chatSala).
    await marcarDevolvidasComoLidas(room.id, otherUserId, messages);

    const cronologica = messages.reverse(); // mais antiga primeiro
    return NextResponse.json({
      ok: true,
      messages: cronologica,
      pagination: {
        hasMore,
        // A mais antiga desta página: próximo `?before=`.
        nextCursor: hasMore && cronologica.length > 0 ? cronologica[0].id : null,
      },
    });
  } catch (error: unknown) {
    const sessao = respostaDeSessao(error);
    if (sessao) return sessao;
    return NextResponse.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}

// ─── POST /api/chat/[roomId]/messages ───────────────────────────────────────

export async function POST(req: Request, { params }: Params) {
  try {
    cleanupRateLimit();

    const auth = await requireAuthAtivo(req);
    const { roomId: servicoId } = await params;

    const resolved = await resolveRoom(servicoId, auth.userId);
    if ("error" in resolved) {
      return NextResponse.json({ ok: false, error: resolved.error }, { status: resolved.status });
    }

    const { room, servico } = resolved;
    const ip = getRequestIp(req);
    const rlIp = rateLimit({ key: `chat-ip:${ip}`, limit: 120, windowMs: 60_000 });
    const rlUserRoom = rateLimit({
      key: `chat-user-room:${auth.userId}:${servicoId}`,
      limit: 30,
      windowMs: 60_000,
    });
    if (!rlIp.ok || !rlUserRoom.ok) {
      const resetAt = Math.max(
        !rlIp.ok ? rlIp.resetAt : 0,
        !rlUserRoom.ok ? rlUserRoom.resetAt : 0,
      );
      return NextResponse.json(
        {
          ok: false,
          error: "RATE_LIMITED",
          message: "Muitas mensagens enviadas. Aguarde um pouco e tente novamente.",
          retryAfterMs: rateLimitRetryAfterMs(resetAt),
        },
        { status: 429 },
      );
    }

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
        deliveredAt: true,
        readAt: true,
        createdAt: true,
        sender: { select: { id: true, nome: true, avatarUrl: true } },
      },
    });

    // Acorda os clientes em tempo real (best-effort): evento leve, sem conteúdo.
    // O banco permanece a fonte da verdade; falha do Ably não afeta o 201.
    await publishChatEvent(servicoId, { id: message.id, roomId: room.id, type: message.type });

    // Notifica a outra parte da nova mensagem (best-effort).
    try {
      const profissionalUserId = servico.montadorId ?? servico.diaristaId;
      const outroUsuarioId =
        auth.userId === servico.clientId ? profissionalUserId : servico.clientId;
      if (outroUsuarioId) {
        const preview =
          parsed.data.type === "TEXT"
            ? parsed.data.content.length > 80
              ? `${parsed.data.content.slice(0, 77)}...`
              : parsed.data.content
            : parsed.data.type === "IMAGE"
              ? "📷 Imagem"
              : "📍 Localização";
        // Gate anti-duplicação: destinatário presente na sala em tempo real
        // (canal Ably) → realtime já entrega, pula o push; a Notification in-app
        // continua criada. Fail-open (Ably fora → push).
        const presente = await isUserPresentInRoom(servicoId, outroUsuarioId);
        await criarNotificacao({
          userId: outroUsuarioId,
          type: "CHAT_NOVA_MENSAGEM",
          title: message.sender.nome || "Nova mensagem",
          body: preview,
          servicoId,
          chatRoomId: room.id,
          sendPush: !presente,
        });
      }
    } catch (e) {
      console.error("[chat] erro criando notificação de mensagem:", e);
    }

    return NextResponse.json({ ok: true, message }, { status: 201 });
  } catch (error: unknown) {
    const sessao = respostaDeSessao(error);
    if (sessao) return sessao;
    return NextResponse.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}
