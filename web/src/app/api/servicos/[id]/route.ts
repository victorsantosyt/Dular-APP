import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { maskPixKey } from "@/lib/pix";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const auth = requireAuth(req);
    const { id } = await params;

    const servico = await prisma.servico.findUnique({
      where: { id },
      include: {
        cliente: { select: { id: true, nome: true, telefone: true, avatarUrl: true } },
        diarista: { select: { id: true, nome: true, telefone: true, avatarUrl: true } },
        montador: { select: { id: true, nome: true, telefone: true, avatarUrl: true } },
        avaliacao: true,
        avaliacaoEmpregador: true,
        // Para o comprovante: quem recebeu o pagamento. O snapshot é imutável
        // e congelado na contratação — é justamente a prova de para onde o
        // dinheiro foi, e não mudava nem se o profissional trocasse a chave
        // depois.
        pixSnapshot: {
          select: { pixType: true, pixKey: true, bank: true, holderName: true, createdAt: true },
        },
        // Data de finalização sem migration: último evento de finalização.
        eventos: {
          where: { toStatus: { in: ["CONCLUIDO", "CONFIRMADO", "FINALIZADO"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true, toStatus: true },
        },
      },
    });

    if (!servico) {
      return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });
    }

    const profissionalUserId = servico.montadorId ?? servico.diaristaId;
    const isParticipant =
      servico.clientId === auth.userId || profissionalUserId === auth.userId;
    if (!isParticipant && auth.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
    }

    const otherUserId =
      auth.userId === servico.clientId ? profissionalUserId : servico.clientId;

    // P0-6: enderecoCompleto só exposto para participante em status ativo pós-aceite.
    // Espelha a regra de /api/servicos/minhas/route.ts (canSeeAddress).
    // Profissional também vê em SOLICITADO (precisa saber onde ir se aceitar).
    const isProfissional = auth.role === "DIARISTA" || auth.role === "MONTADOR";
    const canSeeAddress =
      servico.status === "ACEITO" ||
      servico.status === "EM_ANDAMENTO" ||
      servico.status === "AGUARDANDO_FINALIZACAO" ||
      servico.status === "CONCLUIDO" ||
      servico.status === "CONFIRMADO" ||
      servico.status === "FINALIZADO" ||
      (isProfissional && servico.status === "SOLICITADO") ||
      auth.role === "ADMIN";

    const endereco = canSeeAddress ? servico.enderecoCompleto : null;

    // A chave sai MASCARADA. O comprovante precisa dizer para quem o dinheiro
    // foi (titular, banco, tipo da chave) — não precisa da chave inteira, que
    // só a tela de pagamento entrega, e só para o empregador.
    const { pixSnapshot, ...resto } = servico;
    const recebimento = pixSnapshot
      ? {
          titular: pixSnapshot.holderName,
          banco: pixSnapshot.bank,
          tipoChave: pixSnapshot.pixType,
          chaveMascarada: maskPixKey(pixSnapshot.pixKey),
          congeladoEm: pixSnapshot.createdAt,
        }
      : null;

    return NextResponse.json({
      ok: true,
      servico: {
        ...resto,
        enderecoCompleto: endereco,
        endereco,
        recebimento,
      },
      otherUserId,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Erro";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
