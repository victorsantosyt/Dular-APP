import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

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
        precoLeve: true,
        precoMedio: true,
        precoPesada: true,
        notaMedia: true,
        totalServicos: true,
        servicosOferecidos: true,
        bairros: {
          include: {
            bairro: {
              select: {
                nome: true,
                cidade: true,
                uf: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            nome: true,
            telefone: true,
            status: true,
            avatarUrl: true,
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

    const avatarUrl = diarista.fotoUrl ?? diarista.user.avatarUrl;
    const bairros = diarista.bairros.map((db) => ({
      nome: db.bairro.nome,
      cidade: db.bairro.cidade,
      uf: db.bairro.uf,
    }));

    return NextResponse.json({
      ok: true,
      diarista: {
        id: diarista.id,
        userId: diarista.userId,
        nome: diarista.user.nome,
        avatarUrl,
        bio: diarista.bio,
        verificacao: diarista.verificacao,
        servicosOferecidos: diarista.servicosOferecidos,
        bairros,
        precos: {
          leve: diarista.precoLeve,
          medio: diarista.precoMedio,
          pesada: diarista.precoPesada,
        },
        notaMedia: diarista.notaMedia,
        totalServicos: diarista.totalServicos,
        safeScore: diarista.user.safeScoreProfile
          ? {
              score: diarista.user.safeScoreProfile.currentScore,
              tier: diarista.user.safeScoreProfile.tier,
            }
          : null,
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
