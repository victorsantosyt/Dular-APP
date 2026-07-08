import { auth } from "@/lib/auth-oauth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PIX_STATUSES_ELEGIVEIS, profissionalIdDoServico } from "@/lib/pagamentoPix";
import { PixPagamentoPanel } from "@/components/pix/PixPagamentoPanel";

export const dynamic = "force-dynamic";

/**
 * Pagamento via PIX do serviço — visão do empregador (pagar) e do
 * profissional (confirmar/contestar recebimento). Todo dado sensível
 * (valor, chave, txid) é resolvido pelo backend; esta página só orquestra.
 */
export default async function PagamentoServicoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const servico = await prisma.servico.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      precoFinal: true,
      tipo: true,
      clientId: true,
      diaristaId: true,
      montadorId: true,
      diarista: { select: { nome: true } },
      montador: { select: { nome: true } },
    },
  });
  if (!servico) redirect("/");

  const uid = session.user.id;
  const profissionalId = profissionalIdDoServico(servico);
  const isEmpregador = servico.clientId === uid;
  const isProfissional = profissionalId === uid;
  if (!isEmpregador && !isProfissional) redirect("/");

  // O snapshot congelado do serviço é a fonte canônica dos dados de
  // recebimento; o PaymentInfo atual só é olhado enquanto não há snapshot.
  const snapshot = await prisma.pixSnapshot.findUnique({
    where: { servicoId: servico.id },
    select: { holderName: true },
  });
  const paymentInfo =
    !snapshot && profissionalId
      ? await prisma.paymentInfo.findUnique({
          where: { userId: profissionalId },
          select: { holderName: true },
        })
      : null;

  const profissionalNome =
    snapshot?.holderName ??
    paymentInfo?.holderName ??
    servico.montador?.nome ??
    servico.diarista?.nome ??
    "Profissional";

  return (
    <main className="min-h-screen bg-dular-bg px-4 pb-16">
      <div className="mx-auto w-full max-w-[420px] pt-6">
        <h1 className="mb-1 text-[19px] font-black text-dular-ink">Pagamento</h1>
        <p className="mb-5 text-[12px] font-medium text-dular-sub">
          Pagamento direto entre as partes via PIX — a Dular não recebe valores.
        </p>
        <PixPagamentoPanel
          servicoId={servico.id}
          papel={isEmpregador ? "EMPREGADOR" : "PROFISSIONAL"}
          paymentStatus={servico.paymentStatus}
          valorCentavos={servico.precoFinal}
          profissionalNome={profissionalNome}
          profissionalTemPix={snapshot !== null || paymentInfo !== null}
          elegivel={PIX_STATUSES_ELEGIVEIS.includes(servico.status)}
        />
      </div>
    </main>
  );
}
