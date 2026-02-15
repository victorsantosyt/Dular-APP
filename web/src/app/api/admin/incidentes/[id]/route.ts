import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { signGetUrl } from "@/lib/s3Objects";
import { recomputeRiskForUser } from "@/lib/risk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAuth(_req);
    if (auth.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Acesso negado" }, { status: 403 });
    }

    const { id } = await params;
    const incident = await prisma.incidentReport.findUnique({
      where: { id },
      include: {
        attachments: true,
        reportedUser: { select: { id: true, nome: true, role: true } },
        reportedBy: { select: { id: true, nome: true, role: true } },
      },
    });

    if (!incident) {
      return NextResponse.json({ ok: false, error: "Não encontrado" }, { status: 404 });
    }

    const attachments = await Promise.all(
      incident.attachments.map(async (a) => ({
        ...a,
        signedUrl: await signGetUrl(a.key, 120),
      }))
    );

    return NextResponse.json({ ok: true, incident: { ...incident, attachments } });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Acesso negado" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const status = (body?.status as string | undefined)?.toUpperCase();
    const allowed = ["ABERTO", "EM_ANALISE", "CONFIRMADO", "ENCERRADO"];
    if (!status || !allowed.includes(status)) {
      return NextResponse.json({ ok: false, error: "Status inválido" }, { status: 400 });
    }

    const incident = await prisma.incidentReport.update({
      where: { id },
      data: { status: status as any },
    });

    if (status === "CONFIRMADO") {
      await recomputeRiskForUser(incident.reportedUserId);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}
