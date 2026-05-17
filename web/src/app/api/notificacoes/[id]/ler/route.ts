import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/notificacoes/[id]/ler
//
// Marca uma notificação como lida (`readAt = now`). Idempotente — chamadas
// repetidas mantêm o `readAt` original do primeiro acesso.
//
// 401 se não autenticado, 403 se a notificação não pertence ao usuário,
// 404 se não existe.
export async function PATCH(req: Request, { params }: Params) {
  const t0 = Date.now();
  const isDev = process.env.NODE_ENV === "development";
  try {
    const tAuth = Date.now();
    const auth = requireAuth(req);
    if (isDev) console.log(`[notificacoes/[id]/ler PATCH] auth: ${Date.now() - tAuth}ms`);

    const { id } = await params;

    const tQuery = Date.now();
    const notification = await prisma.notification.findUnique({
      where: { id },
      select: { id: true, userId: true, readAt: true },
    });
    if (isDev) console.log(`[notificacoes/[id]/ler PATCH] query: ${Date.now() - tQuery}ms`);

    if (!notification) {
      if (isDev) console.log(`[notificacoes/[id]/ler PATCH] TOTAL: ${Date.now() - t0}ms (404)`);
      return NextResponse.json(
        { ok: false, error: "Notificação não encontrada." },
        { status: 404 },
      );
    }

    if (notification.userId !== auth.userId) {
      if (isDev) console.log(`[notificacoes/[id]/ler PATCH] TOTAL: ${Date.now() - t0}ms (403)`);
      return NextResponse.json({ ok: false, error: "Acesso negado." }, { status: 403 });
    }

    // Idempotente — só atualiza se ainda não foi lida.
    if (notification.readAt) {
      if (isDev) console.log(`[notificacoes/[id]/ler PATCH] TOTAL: ${Date.now() - t0}ms (idempotent)`);
      return NextResponse.json({ ok: true, idempotent: true });
    }

    const tUpdate = Date.now();
    await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    if (isDev) console.log(`[notificacoes/[id]/ler PATCH] update: ${Date.now() - tUpdate}ms`);

    if (isDev) console.log(`[notificacoes/[id]/ler PATCH] TOTAL: ${Date.now() - t0}ms`);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (isDev) console.log(`[notificacoes/[id]/ler PATCH] ERROR after ${Date.now() - t0}ms: ${msg}`);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}
