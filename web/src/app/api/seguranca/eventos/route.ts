import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/seguranca/eventos — lista os SafetyEvents do usuário autenticado
 * (SOS e check-in), do mais recente para o mais antigo. Usado pelo
 * "Acompanhamento de SOS" na tela SafeScore.
 *
 * Query params:
 *  - type: "SOS_SILENT" | "CHECKIN_OK" (opcional — filtra por tipo)
 *  - limit: 1..50 (padrão 20)
 */
export async function GET(req: Request) {
  try {
    const auth = requireAuth(req);
    const url = new URL(req.url);
    const typeParam = url.searchParams.get("type");
    const type =
      typeParam === "SOS_SILENT" || typeParam === "CHECKIN_OK" ? typeParam : undefined;
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 50);

    const eventos = await prisma.safetyEvent.findMany({
      where: { userId: auth.userId, ...(type ? { type } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, type: true, serviceId: true, createdAt: true, meta: true },
    });

    return NextResponse.json({ ok: true, eventos });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}
