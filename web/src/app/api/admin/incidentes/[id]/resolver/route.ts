import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { aplicarEvento, getFaixa } from "@/lib/safeScore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Acesso negado" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => null);
    const resolucao = (body?.resolucao as string | undefined)?.toUpperCase();
    const observacao = (body?.observacao as string | undefined)?.trim();
    const allowed = ["CONFIRMADA", "ARQUIVADA"];

    if (!resolucao || !allowed.includes(resolucao)) {
      return NextResponse.json({ ok: false, error: "Resolução inválida" }, { status: 400 });
    }

    const incident = await prisma.incidentReport.update({
      where: { id },
      data: { resolucao: resolucao as "CONFIRMADA" | "ARQUIVADA" },
    });

    const safeScore =
      resolucao === "CONFIRMADA"
        ? await aplicarEvento(
            incident.reportedUserId,
            "DENUNCIA_CONFIRMADA",
            incident.id,
            observacao ? `${observacao} gravidade=${incident.gravidade}` : `gravidade=${incident.gravidade}`,
          )
        : await aplicarEvento(
            incident.reportedUserId,
            "DENUNCIA_ARQUIVADA",
            incident.id,
            observacao,
          );

    const faixa = getFaixa(safeScore.score);
    return NextResponse.json({ ok: true, safeScore, faixa });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    if (e?.code === "P2025") {
      return NextResponse.json({ ok: false, error: "Incidente não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}
