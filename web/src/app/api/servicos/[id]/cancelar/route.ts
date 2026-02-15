import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { cancelarServicoSchema } from "@/lib/schemas/servicos";
import { assertStatus, isCancelamentoTardio } from "@/lib/regrasServico";
import { ServicoStatus } from "@prisma/client";
import { registrarEvento } from "@/lib/servicoEvento";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const auth = requireAuth(req);
    const { id } = await params;

    const body = await req.json().catch(() => ({}));
    const parsed = cancelarServicoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
    }

    const servico = await prisma.servico.findUnique({ where: { id } });
    if (!servico) return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });

    const isCliente = servico.clientId === auth.userId;
    const isDiarista = servico.diaristaId === auth.userId;

    if (!isCliente && !isDiarista && auth.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
    }

    assertStatus(servico.status as ServicoStatus, ["SOLICITADO", "ACEITO"]);

    const tardio = isCancelamentoTardio(servico.data);
    const motivoTag = tardio ? "TARDIO" : "OK";

    const updated = await prisma.servico.update({
      where: { id },
      data: {
        status: "CANCELADO",
        observacoes: [
          servico.observacoes ?? "",
          `\n[CANCELADO ${motivoTag} por ${auth.role}] ${parsed.data.motivo ?? ""}`.trim(),
        ]
          .join(" ")
          .trim(),
      },
    });

    await registrarEvento(servico.id, servico.status as ServicoStatus, "CANCELADO", auth.role, auth.userId);

    return NextResponse.json({ ok: true, tardio, servico: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro";
    const code = msg === "INVALID_STATUS" ? 409 : 500;
    if (msg === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: code });
  }
}
