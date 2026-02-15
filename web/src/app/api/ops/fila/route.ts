import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export async function GET(req: Request) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Apenas admin." }, { status: 403 });
    }

    const agora = Date.now();
    const limiteAceite = new Date(agora - 30 * 60 * 1000); // 30 min
    const limiteConfirmacao = new Date(agora - 12 * 60 * 60 * 1000); // 12h

    const pendentesAceite = await prisma.servico.findMany({
      where: {
        status: "SOLICITADO",
        createdAt: { lt: limiteAceite },
      },
      orderBy: { createdAt: "asc" },
      include: {
        cliente: { select: { nome: true, telefone: true } },
        diarista: { select: { nome: true, telefone: true } },
      },
      take: 200,
    });

    const pendentesConfirmacao = await prisma.servico.findMany({
      where: {
        status: "CONCLUIDO",
        updatedAt: { lt: limiteConfirmacao },
      },
      orderBy: { updatedAt: "asc" },
      include: {
        cliente: { select: { nome: true, telefone: true } },
        diarista: { select: { nome: true, telefone: true } },
      },
      take: 200,
    });

    return NextResponse.json({ ok: true, pendentesAceite, pendentesConfirmacao });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
