import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStatus } from "@/lib/regrasServico";
import { buildPixPayload, maskPixKey } from "@/lib/pix";
import {
  PIX_PAGAVEL,
  PIX_STATUSES_ELEGIVEIS,
  profissionalIdDoServico,
  registrarPaymentEvent,
  requireAuthOuSessao,
} from "@/lib/pagamentoPix";
import type { ServicoStatus } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

/**
 * POST /api/servicos/[id]/pix — gera o PIX Copia e Cola do serviço.
 *
 * SEGURANÇA: nenhum dado vem do body. Valor = Servico.precoFinal (congelado),
 * TxId = Servico.id, chave/nome = PaymentInfo do profissional, cidade = a do
 * serviço. Só o empregador dono do serviço pode gerar.
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
        precoFinal: true,
        cidade: true,
        tipo: true,
        clientId: true,
        diaristaId: true,
        montadorId: true,
      },
    });
    if (!servico) {
      return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });
    }

    // Quem paga é o empregador do serviço — e mais ninguém.
    if (servico.clientId !== auth.userId) {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
    }

    assertStatus(servico.status as ServicoStatus, [...PIX_STATUSES_ELEGIVEIS]);

    if (!PIX_PAGAVEL.includes(servico.paymentStatus)) {
      return NextResponse.json(
        { ok: false, error: "Pagamento já informado ou confirmado para este serviço." },
        { status: 409 },
      );
    }

    const profissionalId = profissionalIdDoServico(servico);
    if (!profissionalId) {
      return NextResponse.json(
        { ok: false, error: "Serviço sem profissional atribuído." },
        { status: 409 },
      );
    }

    const paymentInfo = await prisma.paymentInfo.findUnique({
      where: { userId: profissionalId },
      select: { pixType: true, pixKey: true, bank: true, holderName: true },
    });
    if (!paymentInfo) {
      return NextResponse.json(
        { ok: false, error: "O profissional ainda não cadastrou uma chave PIX." },
        { status: 409 },
      );
    }

    const copiaECola = buildPixPayload({
      pixKey: paymentInfo.pixKey,
      holderName: paymentInfo.holderName,
      city: servico.cidade,
      amountCents: servico.precoFinal,
      txid: servico.id,
      description: "Servico Dular",
    });

    await registrarPaymentEvent(servico.id, "PIX_GENERATED", "EMPREGADOR", auth.userId);
    // Log sem a chave completa (requisito de segurança).
    console.log(
      `[pix] gerado servico=${servico.id} valor=${servico.precoFinal} chave=${maskPixKey(paymentInfo.pixKey)}`,
    );

    return NextResponse.json({
      ok: true,
      pix: {
        copiaECola,
        valorCentavos: servico.precoFinal,
        txid: servico.id,
        profissional: { nome: paymentInfo.holderName },
        chaveMascarada: maskPixKey(paymentInfo.pixKey),
        tipoChave: paymentInfo.pixType,
        banco: paymentInfo.bank,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro";
    if (msg === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    const code = msg === "FORBIDDEN" ? 403 : msg === "INVALID_STATUS" ? 409 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status: code });
  }
}
