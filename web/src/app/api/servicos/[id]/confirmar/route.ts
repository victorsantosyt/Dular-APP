import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { assertStatus } from "@/lib/regrasServico";
import { ServicoStatus } from "@prisma/client";
import { registrarEvento } from "@/lib/servicoEvento";
import { aplicarEvento } from "@/lib/safeScore";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "EMPREGADOR") {
      return NextResponse.json({ ok: false, error: "Apenas empregador pode confirmar." }, { status: 403 });
    }

    const { id } = await params;
    const servico = await prisma.servico.findUnique({ where: { id } });
    if (!servico) return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });

    if (servico.clientId !== auth.userId) {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
    }

    assertStatus(servico.status as ServicoStatus, ["CONCLUIDO"]);

    const updated = await prisma.servico.update({
      where: { id },
      data: { status: "CONFIRMADO" },
    });

    await registrarEvento(servico.id, servico.status as ServicoStatus, "CONFIRMADO", auth.role, auth.userId);
    await Promise.all([
      aplicarEvento(servico.clientId, "SERVICO_CONCLUIDO", servico.id, "Serviço confirmado pelo empregador."),
      aplicarEvento(servico.diaristaId, "SERVICO_CONCLUIDO", servico.id, "Serviço confirmado pelo empregador."),
    ]);

    return NextResponse.json({ ok: true, servico: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro";
    const code = msg === "INVALID_STATUS" ? 409 : 500;
    if (msg === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: code });
  }
}
