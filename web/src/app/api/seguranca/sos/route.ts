import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const auth = requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const serviceId = body?.serviceId as string | undefined;
    const lat = typeof body?.lat === "number" ? body.lat : undefined;
    const lng = typeof body?.lng === "number" ? body.lng : undefined;

    await prisma.$transaction(async (tx) => {
      await tx.safetyEvent.create({
        data: {
          type: "SOS_SILENT",
          userId: auth.userId,
          serviceId: serviceId || null,
          lat: lat ?? null,
          lng: lng ?? null,
        },
      });

      if (serviceId) {
        const svc = await tx.servico.findUnique({ where: { id: serviceId } });
        const reportedUserId =
          auth.userId === svc?.clientId
            ? svc?.diaristaId
            : auth.userId === svc?.diaristaId
            ? svc?.clientId
            : null;

        if (reportedUserId) {
          await tx.incidentReport.create({
            data: {
              reportedById: auth.userId,
              reportedUserId,
              serviceId,
              type: "OUTRO",
              severity: "ALTA",
              description: "SOS silencioso acionado pelo usuário.",
              status: "ABERTO",
            },
          });
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}
