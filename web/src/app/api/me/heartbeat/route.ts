import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export const dynamic = "force-dynamic";

/**
 * POST /api/me/heartbeat
 *
 * Marca presença do usuário autenticado (lastSeenAt = now). O mobile chama a
 * cada ~30s enquanto uma conversa está aberta (useChat). Sem rate limit
 * adicional — a cadência do cliente já é baixa.
 */
export async function POST(req: Request) {
  try {
    const auth = requireAuth(req);

    await prisma.user.update({
      where: { id: auth.userId },
      data: { lastSeenAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    if (msg === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
