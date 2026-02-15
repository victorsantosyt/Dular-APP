import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export async function GET(req: Request) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "DIARISTA") {
      return NextResponse.json({ ok: false, error: "Apenas diarista." }, { status: 403 });
    }

    const profile = await prisma.diaristaProfile.findUnique({
      where: { userId: auth.userId },
      include: {
        user: { select: { id: true, nome: true, telefone: true, status: true } },
        agenda: true,
        bairros: {
          include: { bairro: true },
        },
      },
    });

    if (!profile) {
      return NextResponse.json({ ok: false, error: "Perfil não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, profile });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Erro";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
