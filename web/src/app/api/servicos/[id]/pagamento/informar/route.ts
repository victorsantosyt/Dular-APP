import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStatus } from "@/lib/regrasServico";
import { criarNotificacao } from "@/lib/notifications";
import {
  PIX_PAGAVEL,
  PIX_STATUSES_ELEGIVEIS,
  enviarMensagemSistema,
  profissionalIdDoServico,
  registrarPaymentEvent,
  requireAuthOuSessao,
} from "@/lib/pagamentoPix";
import type { ServicoStatus } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

/**
 * POST /api/servicos/[id]/pagamento/informar — o EMPREGADOR declara que
 * realizou o PIX. paymentStatus: WAITING_PAYMENT|PAYMENT_DISPUTED → PAYMENT_REPORTED.
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
    if (servico.clientId !== auth.userId) {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
    }

    assertStatus(servico.status as ServicoStatus, [...PIX_STATUSES_ELEGIVEIS]);

    if (!PIX_PAGAVEL.includes(servico.paymentStatus)) {
      return NextResponse.json(
        { ok: false, error: "Pagamento já informado ou confirmado." },
        { status: 409 },
      );
    }

    // Transição atômica (compare-and-set): o WHERE inclui o estado de origem,
    // então duplo clique/retry/corrida nunca aplica a transição duas vezes —
    // a segunda requisição encontra count=0 e recebe 409, sem evento duplicado.
    const paymentReportedAt = new Date();
    const cas = await prisma.servico.updateMany({
      where: { id, paymentStatus: { in: [...PIX_PAGAVEL] } },
      data: { paymentStatus: "PAYMENT_REPORTED", paymentReportedAt },
    });
    if (cas.count === 0) {
      return NextResponse.json(
        { ok: false, error: "Pagamento já informado ou confirmado." },
        { status: 409 },
      );
    }
    const updated = {
      id: servico.id,
      paymentStatus: "PAYMENT_REPORTED" as const,
      paymentReportedAt,
    };

    await registrarPaymentEvent(servico.id, "PAYMENT_REPORTED", "EMPREGADOR", auth.userId);

    const profissionalId = profissionalIdDoServico(servico);
    if (profissionalId) {
      await criarNotificacao({
        userId: profissionalId,
        type: "PAGAMENTO_INFORMADO",
        title: "Pagamento informado",
        body: "O empregador informou que realizou o pagamento via PIX.",
        servicoId: servico.id,
      });
    }
    await enviarMensagemSistema(
      servico.id,
      auth.userId,
      "O empregador informou que realizou o pagamento via PIX.",
    );

    return NextResponse.json({ ok: true, servico: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro";
    if (msg === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    const code = msg === "FORBIDDEN" ? 403 : msg === "INVALID_STATUS" ? 409 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status: code });
  }
}
