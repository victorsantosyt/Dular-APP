import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

const SERVICOS_OFERECIDOS = ["DIARISTA", "BABA", "COZINHEIRA"] as const;
type ServicoOferecido = (typeof SERVICOS_OFERECIDOS)[number];

function normalizeServicosOferecidos(value: unknown): ServicoOferecido[] | null {
  if (!Array.isArray(value)) return null;
  const normalized = value.filter(
    (item): item is ServicoOferecido =>
      item === "DIARISTA" || item === "BABA" || item === "COZINHEIRA",
  );
  if (normalized.length !== value.length || normalized.length === 0) return null;
  return Array.from(new Set(normalized));
}

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

export async function PATCH(req: Request) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "DIARISTA") {
      return NextResponse.json({ ok: false, error: "Apenas diarista." }, { status: 403 });
    }

    const body = await req.json();
    const servicosOferecidos = normalizeServicosOferecidos(body?.servicosOferecidos);
    if (!servicosOferecidos) {
      return NextResponse.json({ ok: false, error: "Serviços oferecidos inválidos." }, { status: 400 });
    }

    const profile = await prisma.diaristaProfile.update({
      where: { userId: auth.userId },
      data: { servicosOferecidos },
      include: {
        user: { select: { id: true, nome: true, telefone: true, status: true } },
        agenda: true,
        bairros: {
          include: { bairro: true },
        },
      },
    });

    return NextResponse.json({ ok: true, profile });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Erro";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
