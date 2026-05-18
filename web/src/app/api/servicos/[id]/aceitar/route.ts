import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { assertRole } from "@/lib/regrasServico";
import { ServicoStatus, UserRole } from "@prisma/client";
import { registrarEvento } from "@/lib/servicoEvento";
import { criarNotificacao } from "@/lib/notifications";
import {
  VerificacaoObrigatoriaError,
  verificacaoErrorResponseBody,
} from "@/lib/profileVerification";
import {
  assertGuardianProfessionalCanAcceptServico,
  GuardianBlockedError,
  guardianErrorResponseBody,
} from "@/lib/safeScoreGuardian";

type Params = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: Params) {
  try {
    const auth = requireAuth(req);
    assertRole(auth.role as UserRole, ["DIARISTA", "MONTADOR"]);

    // T-18.6: gate via SafeScore Guardian (verificação + restrições + score).
    await assertGuardianProfessionalCanAcceptServico(
      auth.userId,
      auth.role as "DIARISTA" | "MONTADOR",
    );

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

    const isDiarista = servico.diaristaId === auth.userId;
    const isMontador = servico.montadorId === auth.userId;
    if (!isDiarista && !isMontador) {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
    }

    // Status atual exposto no 409 para o mobile sincronizar a UI sem re-fetch
    // separado. Mantém a mesma regra (apenas SOLICITADO pode ser aceito).
    if (servico.status !== "SOLICITADO") {
      return NextResponse.json(
        {
          ok: false,
          error:
            servico.status === "ACEITO"
              ? "Serviço já aceito."
              : "Serviço não pode ser aceito neste estado.",
          statusAtual: servico.status,
        },
        { status: 409 },
      );
    }

    const updated = await prisma.servico.update({
      where: { id },
      data: {
        status: "ACEITO",
        enderecoCompleto: enderecoCompleto ?? servico.enderecoCompleto ?? null,
      },
    });

    // Garante ChatRoom no aceite. Em fluxos normais o room é criado em POST
    // /api/servicos, mas serviços antigos (pré-T-16) podem não ter sala — o
    // upsert é idempotente e mantém o chat acessível assim que o aceite é
    // confirmado.
    try {
      await prisma.chatRoom.upsert({
        where: { servicoId: servico.id },
        update: {},
        create: { servicoId: servico.id },
      });
    } catch (e) {
      console.error("[servicos/aceitar] erro garantindo chatRoom:", e);
    }

    await registrarEvento(servico.id, servico.status as ServicoStatus, "ACEITO", auth.role as UserRole, auth.userId);

    await criarNotificacao({
      userId: servico.clientId,
      type: "SERVICO_ACEITO",
      title: "Sua solicitação foi aceita",
      body: "O profissional aceitou sua solicitação. Confira os detalhes.",
      servicoId: servico.id,
    });

    return NextResponse.json({ ok: true, servico: updated });
  } catch (error: unknown) {
    if (error instanceof GuardianBlockedError) {
      return NextResponse.json(guardianErrorResponseBody(error), {
        status: error.httpStatus,
      });
    }
    if (error instanceof VerificacaoObrigatoriaError) {
      return NextResponse.json(verificacaoErrorResponseBody(error), {
        status: error.httpStatus,
      });
    }
    const msg = error instanceof Error ? error.message : "Erro";
    const code = msg === "FORBIDDEN" ? 403 : msg === "INVALID_STATUS" ? 409 : 500;
    if (msg === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: code });
  }
}
