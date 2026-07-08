import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { registrarPaymentEvent, requireAuthOuSessao } from "@/lib/pagamentoPix";

type Params = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

/**
 * POST /api/servicos/[id]/pix/copiado — registra que o empregador copiou o
 * código PIX (evento de auditoria "PIX copiado").
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const auth = await requireAuthOuSessao(req);
    const { id } = await params;

    const servico = await prisma.servico.findUnique({
      where: { id },
      select: { id: true, clientId: true },
    });
    if (!servico) {
      return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });
    }
    if (servico.clientId !== auth.userId) {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
    }

    await registrarPaymentEvent(servico.id, "PIX_COPIED", "EMPREGADOR", auth.userId);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro";
    if (msg === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
