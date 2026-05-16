import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { getDiaristaProfileCompleteness } from "@/lib/diaristaProfile";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ userId: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    // Require authentication (any authenticated user can view)
    requireAuth(_req);

    const { userId } = await params;

    const diarista = await prisma.diaristaProfile.findFirst({
      where: {
        OR: [{ id: userId }, { userId: userId }],
        ativo: true,
        user: { status: "ATIVO" },
      },
      select: {
        id: true,
        userId: true,
        bio: true,
        fotoUrl: true,
        verificacao: true,
        ativo: true,
        precoLeve: true,
        precoMedio: true,
        precoPesada: true,
        notaMedia: true,
        totalServicos: true,
        servicosOferecidos: true,
        cidade: true,
        estado: true,
        atendeTodaCidade: true,
        raioAtendimentoKm: true,
        anosExperiencia: true,
        precoBabaHora: true,
        precoCozinheiraBase: true,
        taxaMinima: true,
        cobraDeslocamento: true,
        valorACombinar: true,
        observacaoPreco: true,
        portfolioFotos: true,
        bairros: {
          select: {
            bairro: {
              select: {
                nome: true,
                cidade: true,
                uf: true,
              },
            },
          },
        },
        agenda: {
          select: {
            id: true,
            diaSemana: true,
            turno: true,
            ativo: true,
          },
          orderBy: [{ diaSemana: "asc" }, { turno: "asc" }],
        },
        user: {
          select: {
            id: true,
            nome: true,
            telefone: true,
            status: true,
            avatarUrl: true,
            habilidades: {
              select: {
                id: true,
                tipo: true,
                categoria: true,
              },
              orderBy: [{ tipo: "asc" }, { categoria: "asc" }],
            },
            safeScoreProfile: {
              select: {
                currentScore: true,
                tier: true,
              },
            },
          },
        },
      },
    });

    if (!diarista) {
      return NextResponse.json(
        { ok: false, error: "Diarista não encontrada." },
        { status: 404 },
      );
    }

    const avatarUrl = diarista.fotoUrl ?? diarista.user.avatarUrl ?? null;
    const bairros = diarista.bairros.map((db) => ({
      nome: db.bairro.nome,
      cidade: db.bairro.cidade,
      uf: db.bairro.uf,
    }));

    const completude = getDiaristaProfileCompleteness({
      ativo: diarista.ativo,
      bio: diarista.bio,
      servicosOferecidos: diarista.servicosOferecidos,
      cidade: diarista.cidade,
      estado: diarista.estado,
      atendeTodaCidade: diarista.atendeTodaCidade,
      raioAtendimentoKm: diarista.raioAtendimentoKm,
      precoLeve: diarista.precoLeve,
      precoMedio: diarista.precoMedio,
      precoPesada: diarista.precoPesada,
      precoBabaHora: diarista.precoBabaHora,
      precoCozinheiraBase: diarista.precoCozinheiraBase,
      taxaMinima: diarista.taxaMinima,
      valorACombinar: diarista.valorACombinar,
      bairros: diarista.bairros,
      user: { nome: diarista.user.nome, status: diarista.user.status },
    });

    return NextResponse.json({
      ok: true,
      diarista: {
        id: diarista.id,
        userId: diarista.userId,
        nome: diarista.user.nome,
        avatarUrl,
        bio: diarista.bio,
        verificacao: diarista.verificacao,
        verificado: diarista.verificacao === "VERIFICADO",
        ativo: diarista.ativo,
        servicosOferecidos: diarista.servicosOferecidos,
        cidade: diarista.cidade,
        estado: diarista.estado,
        atendeTodaCidade: diarista.atendeTodaCidade,
        raioAtendimentoKm: diarista.raioAtendimentoKm,
        anosExperiencia: diarista.anosExperiencia,
        bairros,
        precos: {
          leve: diarista.precoLeve,
          medio: diarista.precoMedio,
          pesada: diarista.precoPesada,
          babaHora: diarista.precoBabaHora,
          cozinheiraBase: diarista.precoCozinheiraBase,
          taxaMinima: diarista.taxaMinima,
        },
        cobraDeslocamento: diarista.cobraDeslocamento,
        valorACombinar: diarista.valorACombinar,
        observacaoPreco: diarista.observacaoPreco,
        portfolioFotos: diarista.portfolioFotos,
        habilidades: diarista.user.habilidades,
        agenda: diarista.agenda,
        notaMedia: diarista.notaMedia,
        totalServicos: diarista.totalServicos,
        safeScore: diarista.user.safeScoreProfile
          ? {
              score: diarista.user.safeScoreProfile.currentScore,
              tier: diarista.user.safeScoreProfile.tier,
            }
          : null,
        perfilCompleto: completude.completo,
        motivosIncompleto: completude.motivos,
      },
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json(
        { ok: false, error: "Não autorizado" },
        { status: 401 },
      );
    }
    const message = err instanceof Error ? err.message : "Erro ao carregar diarista";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
