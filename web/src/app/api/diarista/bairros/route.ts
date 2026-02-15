import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { updateBairrosSchema } from "@/lib/schemas/diarista";

async function handle(req: Request) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "DIARISTA") {
      return NextResponse.json({ ok: false, error: "Apenas diarista." }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateBairrosSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
    }

    const { cidade, uf, bairros } = parsed.data;

    const profile = await prisma.diaristaProfile.findUnique({ where: { userId: auth.userId } });
    if (!profile) {
      return NextResponse.json({ ok: false, error: "Perfil não encontrado." }, { status: 404 });
    }

    const bairroIds: string[] = [];
    for (const nome of bairros) {
      const b = await prisma.bairro.upsert({
        where: { nome_cidade_uf: { nome, cidade, uf } },
        update: {},
        create: { nome, cidade, uf },
      });
      bairroIds.push(b.id);
    }

    await prisma.diaristaBairro.deleteMany({
      where: {
        diaristaId: profile.id,
        NOT: { bairroId: { in: bairroIds } },
      },
    });

    for (const bairroId of bairroIds) {
      await prisma.diaristaBairro.upsert({
        where: { diaristaId_bairroId: { diaristaId: profile.id, bairroId } },
        update: {},
        create: { diaristaId: profile.id, bairroId },
      });
    }

    const updated = await prisma.diaristaProfile.findUnique({
      where: { id: profile.id },
      include: { bairros: { include: { bairro: true } } },
    });

    return NextResponse.json({ ok: true, bairros: updated?.bairros ?? [] });
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
