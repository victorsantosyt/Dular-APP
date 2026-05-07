import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const auth = requireAuth(req);
    const { id } = await params;

    const servico = await prisma.servico.findUnique({
      where: { id },
      include: {
        cliente: { select: { id: true, nome: true, telefone: true, avatarUrl: true } },
        diarista: { select: { id: true, nome: true, telefone: true, avatarUrl: true } },
        avaliacao: true,
      },
    });

    if (!servico) {
      return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });
    }

    const isParticipant = servico.clientId === auth.userId || servico.diaristaId === auth.userId;
    if (!isParticipant && auth.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
    }

    const otherUserId = auth.userId === servico.clientId ? servico.diaristaId : servico.clientId;

    return NextResponse.json({
      ok: true,
      servico: {
        ...servico,
        endereco: servico.enderecoCompleto,
      },
      otherUserId,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Erro";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
