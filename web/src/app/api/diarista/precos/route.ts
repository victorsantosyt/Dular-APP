import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { updatePrecosSchema } from "@/lib/schemas/diarista";

async function handle(req: Request) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "DIARISTA") {
      return NextResponse.json({ ok: false, error: "Apenas diarista." }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updatePrecosSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
    }

    const { precoLeve, precoPesada, bio } = parsed.data;

    const updated = await prisma.diaristaProfile.update({
      where: { userId: auth.userId },
      data: {
        precoLeve,
        precoPesada,
        bio: bio ?? undefined,
      },
    });

    return NextResponse.json({ ok: true, profile: updated });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Erro";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return handle(req);
}

export async function PUT(req: Request) {
  return handle(req);
}
