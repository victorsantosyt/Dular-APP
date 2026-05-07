import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, nome: true },
    });
    if (!user) {
      return NextResponse.json({ ok: false, error: "Usuário não encontrado" }, { status: 404 });
    }

    const profile = await prisma.safeScoreProfile.findUnique({
      where: { userId: id },
      select: {
        currentScore: true,
        riskScore: true,
        tier: true,
        lastRecalcAt: true,
      },
    });

    const url = new URL(req.url);
    const take = Math.min(Number(url.searchParams.get("limit") ?? "50"), 200);
    const cursor = url.searchParams.get("cursor") ?? undefined;

    const events = await prisma.safeScoreEvent.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        idempotencyKey: true,
        eventType: true,
        source: true,
        sourceId: true,
        actorId: true,
        scoreBefore: true,
        scoreAfter: true,
        delta: true,
        payload: true,
        createdAt: true,
        policyVersion: { select: { version: true } },
      },
    });

    const nextCursor = events.length === take ? events[events.length - 1]?.id : null;

    return NextResponse.json({
      ok: true,
      userId: id,
      profile: profile ?? null,
      events,
      nextCursor,
    });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}
