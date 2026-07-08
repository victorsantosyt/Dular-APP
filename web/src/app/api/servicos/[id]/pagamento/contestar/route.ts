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
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  motivo: z
    .string()
    .trim()
    .min(3, "Informe o motivo da contestação.")
    .max(500, "Motivo muito longo."),
});

/**
 * POST /api/servicos/[id]/pagamento/contestar — o PROFISSIONAL declara que
 * NÃO recebeu. paymentStatus: PAYMENT_REPORTED → PAYMENT_DISPUTED (com motivo).
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

    if (profissionalIdDoServico(servico) !== auth.userId) {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
    }

    if (servico.paymentStatus !== "PAYMENT_REPORTED") {
      return NextResponse.json(
        { ok: false, error: "Não há pagamento informado aguardando confirmação." },
        { status: 409 },
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    // Transição atômica (compare-and-set): corrida entre contestar/confirmar
    // ou retry nunca aplica duas transições — count=0 vira 409.
    const paymentDisputedAt = new Date();
    const cas = await prisma.servico.updateMany({
      where: { id, paymentStatus: "PAYMENT_REPORTED" },
      data: { paymentStatus: "PAYMENT_DISPUTED", paymentDisputedAt },
    });
    if (cas.count === 0) {
      return NextResponse.json(
        { ok: false, error: "Não há pagamento informado aguardando confirmação." },
        { status: 409 },
      );
    }
    const updated = {
      id: servico.id,
      paymentStatus: "PAYMENT_DISPUTED" as const,
      paymentDisputedAt,
    };

    await registrarPaymentEvent(
      servico.id,
      "PAYMENT_DISPUTED",
      auth.role as UserRole,
      auth.userId,
      parsed.data.motivo,
    );

    await criarNotificacao({
      userId: servico.clientId,
      type: "PAGAMENTO_CONTESTADO",
      title: "Pagamento não recebido",
      body: "O profissional informou que ainda não recebeu o pagamento.",
      servicoId: servico.id,
    });
    await enviarMensagemSistema(
      servico.id,
      auth.userId,
      "O profissional informou que ainda não recebeu o pagamento.",
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
