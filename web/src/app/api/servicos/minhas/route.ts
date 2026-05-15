import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export async function GET(req: Request) {
  try {
    const auth = requireAuth(req);

    const where =
      auth.role === "EMPREGADOR"
        ? { clientId: auth.userId }
        : auth.role === "DIARISTA"
          ? { diaristaId: auth.userId }
          : auth.role === "MONTADOR"
            ? { montadorId: auth.userId }
            : auth.role === "ADMIN"
              ? {}
              : null;

    if (!where) {
      return NextResponse.json({ ok: false, error: "Perfil sem serviços neste fluxo." }, { status: 403 });
    }

    // Substituído `include` implícito (que traz TODAS colunas do Servico) por
    // `select` explícito + relacionamentos limitados. Diminui o payload
    // serializado e o trabalho de hidratação do Prisma.
    const servicos = await prisma.servico.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        status: true,
        tipo: true,
        categoria: true,
        data: true,
        turno: true,
        cidade: true,
        uf: true,
        bairro: true,
        enderecoCompleto: true,
        observacoes: true,
        temPet: true,
        quartos3Mais: true,
        banheiros2Mais: true,
        precoFinal: true,
        clientId: true,
        diaristaId: true,
        montadorId: true,
        createdAt: true,
        updatedAt: true,
        cliente: { select: { id: true, nome: true, telefone: true, avatarUrl: true } },
        diarista: { select: { id: true, nome: true, telefone: true, avatarUrl: true } },
        montador: { select: { id: true, nome: true, telefone: true, avatarUrl: true } },
        avaliacao: {
          select: {
            id: true,
            notaGeral: true,
            pontualidade: true,
            qualidade: true,
            comunicacao: true,
            comentario: true,
            createdAt: true,
          },
        },
      },
    });

    const safe = servicos.map((s) => {
      const canSeeAddress =
        s.status === "ACEITO" ||
        s.status === "EM_ANDAMENTO" ||
        s.status === "AGUARDANDO_FINALIZACAO" ||
        s.status === "CONCLUIDO" ||
        s.status === "CONFIRMADO" ||
        s.status === "FINALIZADO" ||
        ((auth.role === "DIARISTA" || auth.role === "MONTADOR") && s.status === "SOLICITADO");

      const endereco = canSeeAddress ? s.enderecoCompleto : null;

      return {
        ...s,
        enderecoCompleto: endereco,
        endereco,
      };
    });

    return NextResponse.json({ ok: true, servicos: safe });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Erro";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
