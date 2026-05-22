import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireServiceParticipant } from "@/lib/requireAuth";
import { z } from "zod";

export const runtime = "nodejs";

const checkinSchema = z.object({
  servicoId: z.string().trim().min(1).optional(),
  serviceId: z.string().trim().min(1).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export async function POST(req: Request) {
  try {
    const auth = requireAuth(req);
    const parsed = checkinSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 });
    }

    const body = parsed.data;
    const serviceId = body.servicoId || body.serviceId;
    const lat = body.latitude ?? body.lat;
    const lng = body.longitude ?? body.lng;

    if (serviceId) {
      await requireServiceParticipant(auth.userId, serviceId, {
        allowAdmin: false,
        role: auth.role,
      });
    }

    await prisma.safetyEvent.create({
      data: {
        type: "CHECKIN_OK",
        userId: auth.userId,
        serviceId: serviceId || null,
        lat: lat ?? null,
        lng: lng ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    if (e?.message === "Forbidden") {
      return NextResponse.json({ ok: false, error: "Acesso negado ao serviço informado." }, { status: 403 });
    }
    if (e?.message === "ServiceNotFound") {
      return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: "Erro interno" }, { status: 500 });
  }
}
