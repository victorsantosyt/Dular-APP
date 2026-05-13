import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { assertRole, assertStatus } from "@/lib/regrasServico";
import { ServicoStatus, UserRole } from "@prisma/client";
import { registrarEvento } from "@/lib/servicoEvento";
import { sendPushNotification } from "@/lib/notifications";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const auth = requireAuth(req);
    assertRole(auth.role as UserRole, ["DIARISTA", "MONTADOR"]);

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const enderecoCompleto =
      typeof body?.enderecoCompleto === "string"
        ? body.enderecoCompleto
        : typeof body?.endereco === "string"
          ? body.endereco
          : null;

    const servico = await prisma.servico.findUnique({ where: { id } });
    if (!servico) return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });

    if (servico.diaristaId !== auth.userId) {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
    }

    assertStatus(servico.status as ServicoStatus, ["SOLICITADO"]);

    const updated = await prisma.servico.update({
      where: { id },
      data: {
        status: "ACEITO",
        enderecoCompleto: enderecoCompleto ?? servico.enderecoCompleto ?? null,
      },
    });

    await registrarEvento(servico.id, servico.status as ServicoStatus, "ACEITO", auth.role as UserRole, auth.userId);

    await sendPushNotification(
      servico.clientId,
      "Serviço aceito",
      "O profissional aceitou sua solicitação. Confira os detalhes.",
      { servicoId: servico.id, tipo: "SERVICO_ACEITO" }
    );

    return NextResponse.json({ ok: true, servico: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro";
    const code = msg === "FORBIDDEN" ? 403 : msg === "INVALID_STATUS" ? 409 : 500;
    if (msg === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: code });
  }
}
