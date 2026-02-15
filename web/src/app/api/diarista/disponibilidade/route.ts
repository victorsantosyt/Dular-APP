import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { updateDisponibilidadeSchema } from "@/lib/schemas/diarista";

async function handle(req: Request) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "DIARISTA") {
      return NextResponse.json({ ok: false, error: "Apenas diarista." }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateDisponibilidadeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
    }

    const profile = await prisma.diaristaProfile.findUnique({ where: { userId: auth.userId } });
    if (!profile) {
      return NextResponse.json({ ok: false, error: "Perfil não encontrado." }, { status: 404 });
    }

    const wantedKeys = parsed.data.slots
      .filter((s) => s.ativo !== false)
      .map((s) => `${s.diaSemana}-${s.turno}`);

    const existing = await prisma.disponibilidade.findMany({
      where: { diaristaId: profile.id },
      select: { id: true, diaSemana: true, turno: true },
    });

    const toDelete = existing.filter((x) => !wantedKeys.includes(`${x.diaSemana}-${x.turno}`));
    if (toDelete.length) {
      await prisma.disponibilidade.deleteMany({
        where: { id: { in: toDelete.map((x) => x.id) } },
      });
    }

    for (const s of parsed.data.slots) {
      if (s.ativo === false) continue;
      await prisma.disponibilidade.upsert({
        where: {
          diaristaId_diaSemana_turno: {
            diaristaId: profile.id,
            diaSemana: s.diaSemana,
            turno: s.turno,
          },
        },
        update: { ativo: true },
        create: {
          diaristaId: profile.id,
          diaSemana: s.diaSemana,
          turno: s.turno,
          ativo: true,
        },
      });
    }

    const agenda = await prisma.disponibilidade.findMany({
      where: { diaristaId: profile.id },
      orderBy: [{ diaSemana: "asc" }, { turno: "asc" }],
    });

    return NextResponse.json({ ok: true, agenda });
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
