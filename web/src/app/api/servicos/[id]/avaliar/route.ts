import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { avaliarServicoSchema } from "@/lib/schemas/servicos";
import { assertStatus, recomputeDiaristaStats } from "@/lib/regrasServico";
import { ServicoStatus } from "@prisma/client";
import { registrarEvento } from "@/lib/servicoEvento";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "CLIENTE") {
      return NextResponse.json({ ok: false, error: "Apenas cliente pode avaliar." }, { status: 403 });
    }

    const { id } = await params;

    const body = await req.json();
    const parsed = avaliarServicoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
    }

    const servico = await prisma.servico.findUnique({
      where: { id },
      include: { avaliacao: true },
    });
    if (!servico) return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });

    if (servico.clientId !== auth.userId) {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
    }

    if (servico.avaliacao) {
      return NextResponse.json({ ok: false, error: "Serviço já avaliado." }, { status: 409 });
    }

    assertStatus(servico.status as ServicoStatus, ["CONFIRMADO"]);

    await prisma.avaliacao.create({
      data: {
        servicoId: servico.id,
        clientId: servico.clientId,
        diaristaId: servico.diaristaId,
        ...parsed.data,
      },
    });

    await prisma.servico.update({
      where: { id: servico.id },
      data: { status: "FINALIZADO" },
    });

    await registrarEvento(servico.id, servico.status as ServicoStatus, "FINALIZADO", auth.role, auth.userId);

    await recomputeDiaristaStats(servico.diaristaId);

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro";
    const code = msg === "INVALID_STATUS" ? 409 : 500;
    if (msg === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: code });
  }
}
