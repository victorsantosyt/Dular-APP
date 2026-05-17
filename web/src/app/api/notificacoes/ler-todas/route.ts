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
  const t0 = Date.now();
  const isDev = process.env.NODE_ENV === "development";
  try {
    const tAuth = Date.now();
    const auth = requireAuth(req);
    if (isDev) console.log(`[notificacoes/ler-todas PATCH] auth: ${Date.now() - tAuth}ms`);

    const tUpdate = Date.now();
    const result = await prisma.notification.updateMany({
      where: { userId: auth.userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (isDev) console.log(`[notificacoes/ler-todas PATCH] update: ${Date.now() - tUpdate}ms`);

    if (isDev) console.log(`[notificacoes/ler-todas PATCH] TOTAL: ${Date.now() - t0}ms`);
    return NextResponse.json({ ok: true, count: result.count });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (isDev) console.log(`[notificacoes/ler-todas PATCH] ERROR after ${Date.now() - t0}ms: ${msg}`);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}
