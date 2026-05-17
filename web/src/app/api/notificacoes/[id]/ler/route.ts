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
  try {
    const auth = requireAuth(req);
    const { id } = await params;

    const notification = await prisma.notification.findUnique({
      where: { id },
      select: { id: true, userId: true, readAt: true },
    });

    if (!notification) {
      return NextResponse.json(
        { ok: false, error: "Notificação não encontrada." },
        { status: 404 },
      );
    }

    if (notification.userId !== auth.userId) {
      return NextResponse.json({ ok: false, error: "Acesso negado." }, { status: 403 });
    }

    // Idempotente — só atualiza se ainda não foi lida.
    if (notification.readAt) {
      return NextResponse.json({ ok: true, idempotent: true });
    }

    await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}
