import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { avaliarServicoSchema } from "@/lib/schemas/servicos";
import { assertStatus, recomputeDiaristaStats, recomputeMontadorStats } from "@/lib/regrasServico";
import { ServicoStatus } from "@prisma/client";
import { registrarEvento } from "@/lib/servicoEvento";
import { aplicarEvento } from "@/lib/safeScore";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "EMPREGADOR") {
      return NextResponse.json({ ok: false, error: "Apenas empregador pode avaliar." }, { status: 403 });
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

    const profissionalId = servico.montadorId ?? servico.diaristaId;
    if (!profissionalId) {
      return NextResponse.json(
        { ok: false, error: "Serviço sem profissional vinculado." },
        { status: 400 },
      );
    }
    const isMontadorServico = !!servico.montadorId;

    const avaliacao = await prisma.avaliacao.create({
      data: {
        servicoId: servico.id,
        clientId: servico.clientId,
        diaristaId: isMontadorServico ? null : servico.diaristaId,
        montadorId: isMontadorServico ? servico.montadorId : null,
        ...parsed.data,
      },
    });

    await prisma.servico.update({
      where: { id: servico.id },
      data: { status: "FINALIZADO" },
    });

    await registrarEvento(servico.id, servico.status as ServicoStatus, "FINALIZADO", auth.role, auth.userId);

    if (isMontadorServico && servico.montadorId) {
      await recomputeMontadorStats(servico.montadorId);
    } else if (!isMontadorServico && servico.diaristaId) {
      await recomputeDiaristaStats(servico.diaristaId);
    }

    await aplicarEvento(
      profissionalId,
      parsed.data.notaGeral >= 4 ? "AVALIACAO_POSITIVA" : "AVALIACAO_NEGATIVA",
      avaliacao.id,
      `nota=${parsed.data.notaGeral}`,
    );

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
