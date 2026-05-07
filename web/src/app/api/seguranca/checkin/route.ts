import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const auth = requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const serviceId = (body?.servicoId || body?.serviceId) as string | undefined;
    const lat =
      typeof body?.latitude === "number"
        ? body.latitude
        : typeof body?.lat === "number"
          ? body.lat
          : undefined;
    const lng =
      typeof body?.longitude === "number"
        ? body.longitude
        : typeof body?.lng === "number"
          ? body.lng
          : undefined;

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
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}
