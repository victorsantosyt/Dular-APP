import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

const ACTIVE_STATUSES = [
  "SOLICITADO",
  "ACEITO",
  "EM_ANDAMENTO",
  "AGUARDANDO_FINALIZACAO",
  "CONCLUIDO",
  "CONFIRMADO",
] as const;

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "EMPREGADOR") {
      return NextResponse.json(
        { ok: false, error: "Apenas empregador." },
        { status: 403 },
      );
    }

    const { id: montadorUserId } = await params;

    const servico = await prisma.servico.findFirst({
      where: {
        clientId: auth.userId,
        montadorId: montadorUserId,
        status: { in: [...ACTIVE_STATUSES] },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        tipo: true,
        categoria: true,
        data: true,
        turno: true,
        bairro: true,
        cidade: true,
        uf: true,
        observacoes: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      ativo: !!servico,
      servico: servico ?? null,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { ok: false, error: "Não autorizado" },
        { status: 401 },
      );
    }
    return NextResponse.json({ ok: false, error: "Erro" }, { status: 500 });
  }
}
