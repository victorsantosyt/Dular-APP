import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export async function GET(req: Request) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "DIARISTA") {
      return NextResponse.json({ ok: false, error: "Apenas diarista." }, { status: 403 });
    }

    const habilidades = await prisma.diaristaHabilidade.findMany({
      where: { diaristaId: auth.userId },
      orderBy: [{ tipo: "asc" }, { categoria: "asc" }],
    });

    return NextResponse.json({ ok: true, habilidades });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "DIARISTA") {
      return NextResponse.json({ ok: false, error: "Apenas diarista." }, { status: 403 });
    }

    const CAT_BY_TIPO: Record<string, string[]> = {
      FAXINA: ["FAXINA_LEVE", "FAXINA_PESADA", "FAXINA_COMPLETA"],
      BABA: ["BABA_DIURNA", "BABA_NOTURNA", "BABA_INTEGRAL"],
      COZINHEIRA: ["COZINHEIRA_DIARIA", "COZINHEIRA_EVENTO"],
      PASSA_ROUPA: ["PASSA_ROUPA_BASICO", "PASSA_ROUPA_COMPLETO"],
    };

    const body = await req.json();
    const habilidades = Array.isArray(body?.habilidades) ? body.habilidades : null;
    if (!habilidades) {
      return NextResponse.json({ ok: false, error: "Habilidades inválidas." }, { status: 400 });
    }

    for (const h of habilidades) {
      if (!h?.tipo || !CAT_BY_TIPO[h.tipo]) {
        return NextResponse.json({ ok: false, error: "Tipo inválido." }, { status: 400 });
      }
      if (h.categoria && !CAT_BY_TIPO[h.tipo].includes(h.categoria)) {
        return NextResponse.json({ ok: false, error: "Categoria inválida para o tipo." }, { status: 400 });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.diaristaHabilidade.deleteMany({ where: { diaristaId: auth.userId } });
      if (habilidades.length) {
        await tx.diaristaHabilidade.createMany({
          data: habilidades.map((h: any) => ({
            diaristaId: auth.userId,
            tipo: h.tipo,
            categoria: h.categoria ?? null,
          })),
          skipDuplicates: true,
        });
      }
    });

    const updated = await prisma.diaristaHabilidade.findMany({
      where: { diaristaId: auth.userId },
      orderBy: [{ tipo: "asc" }, { categoria: "asc" }],
    });

    return NextResponse.json({ ok: true, habilidades: updated });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}
