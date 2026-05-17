import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export const dynamic = "force-dynamic";

// PATCH /api/notificacoes/ler-todas
//
// Marca todas as notificações não-lidas do usuário autenticado como lidas
// em uma única transação. Retorna a quantidade atualizada para o cliente
// poder dar feedback (ex.: "5 notificações marcadas como lidas").
export async function PATCH(req: Request) {
  try {
    const auth = requireAuth(req);

    const result = await prisma.notification.updateMany({
      where: { userId: auth.userId, readAt: null },
      data: { readAt: new Date() },
    });

    return NextResponse.json({ ok: true, count: result.count });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}
