import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export const dynamic = "force-dynamic";

// GET /api/notificacoes
//
// Lista as notificações in-app do usuário autenticado.
// • `?unread=true` filtra apenas as não-lidas.
// • Ordena por `createdAt` desc e devolve no máximo 50 — paginação
//   adicional (cursor) pode entrar quando o histórico crescer.
// • Também devolve `unreadCount` para o badge da aba notificações.
export async function GET(req: Request) {
  const t0 = Date.now();
  const isDev = process.env.NODE_ENV === "development";
  try {
    const tAuth = Date.now();
    const auth = requireAuth(req);
    if (isDev) console.log(`[notificacoes GET] auth: ${Date.now() - tAuth}ms`);

    const url = new URL(req.url);
    const onlyUnread = url.searchParams.get("unread") === "true";

    const tQuery = Date.now();
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: {
          userId: auth.userId,
          ...(onlyUnread ? { readAt: null } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          servicoId: true,
          chatRoomId: true,
          readAt: true,
          createdAt: true,
        },
      }),
      prisma.notification.count({
        where: { userId: auth.userId, readAt: null },
      }),
    ]);
    if (isDev) console.log(`[notificacoes GET] query: ${Date.now() - tQuery}ms`);

    if (isDev) console.log(`[notificacoes GET] TOTAL: ${Date.now() - t0}ms`);
    return NextResponse.json({
      ok: true,
      notifications,
      unreadCount,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (isDev) console.log(`[notificacoes GET] ERROR after ${Date.now() - t0}ms: ${msg}`);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}
