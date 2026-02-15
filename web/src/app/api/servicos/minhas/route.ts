import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export async function GET(req: Request) {
  try {
    const auth = requireAuth(req);

    const where =
      auth.role === "CLIENTE"
        ? { clientId: auth.userId }
        : auth.role === "DIARISTA"
          ? { diaristaId: auth.userId }
          : {};

    const servicos = await prisma.servico.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        cliente: { select: { id: true, nome: true, telefone: true } },
        diarista: { select: { id: true, nome: true, telefone: true } },
        avaliacao: true,
      },
      take: 50,
    });

    const safe = servicos.map((s) => ({
      ...s,
      enderecoCompleto:
        s.status === "ACEITO" ||
        s.status === "EM_ANDAMENTO" ||
        s.status === "CONCLUIDO" ||
        s.status === "CONFIRMADO" ||
        s.status === "FINALIZADO"
          ? s.enderecoCompleto
          : null,
    }));

    return NextResponse.json({ ok: true, servicos: safe });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Erro";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
