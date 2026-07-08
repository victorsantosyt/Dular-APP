import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { criarNotificacao } from "@/lib/notifications";
import {
  enviarMensagemSistema,
  profissionalIdDoServico,
  registrarPaymentEvent,
  requireAuthOuSessao,
} from "@/lib/pagamentoPix";
import type { UserRole } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

/**
 * POST /api/servicos/[id]/pagamento/confirmar — o PROFISSIONAL confirma o
 * recebimento. paymentStatus: PAYMENT_REPORTED → PAYMENT_CONFIRMED.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const auth = await requireAuthOuSessao(req);
    const { id } = await params;

    const servico = await prisma.servico.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        clientId: true,
        diaristaId: true,
        montadorId: true,
      },
    });
    if (!servico) {
      return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });
    }

    // Só o profissional do serviço confirma o recebimento.
    if (profissionalIdDoServico(servico) !== auth.userId) {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
    }

    if (servico.paymentStatus !== "PAYMENT_REPORTED") {
      return NextResponse.json(
        { ok: false, error: "Não há pagamento informado aguardando confirmação." },
        { status: 409 },
      );
    }

    // Transição atômica (compare-and-set): corrida entre confirmar/contestar
    // ou duplo clique nunca aplica duas transições — count=0 vira 409.
    const paymentConfirmedAt = new Date();
    const cas = await prisma.servico.updateMany({
      where: { id, paymentStatus: "PAYMENT_REPORTED" },
      data: { paymentStatus: "PAYMENT_CONFIRMED", paymentConfirmedAt },
    });
    if (cas.count === 0) {
      return NextResponse.json(
        { ok: false, error: "Não há pagamento informado aguardando confirmação." },
        { status: 409 },
      );
    }
    const updated = {
      id: servico.id,
      paymentStatus: "PAYMENT_CONFIRMED" as const,
      paymentConfirmedAt,
    };

    await registrarPaymentEvent(
      servico.id,
      "PAYMENT_CONFIRMED",
      auth.role as UserRole,
      auth.userId,
    );

    await criarNotificacao({
      userId: servico.clientId,
      type: "PAGAMENTO_CONFIRMADO",
      title: "Recebimento confirmado",
      body: "O profissional confirmou o recebimento do pagamento.",
      servicoId: servico.id,
    });
    await enviarMensagemSistema(
      servico.id,
      auth.userId,
      "O profissional confirmou o recebimento do pagamento.",
    );

    return NextResponse.json({ ok: true, servico: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro";
    if (msg === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
