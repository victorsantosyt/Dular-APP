import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Acesso negado" }, { status: 403 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status") || undefined;

    const incidents = await prisma.incidentReport.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { attachments: true } },
        reportedUser: { select: { id: true, nome: true, role: true } },
        reportedBy: { select: { id: true, nome: true, role: true } },
      },
    });

    return NextResponse.json({ ok: true, incidents });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}
