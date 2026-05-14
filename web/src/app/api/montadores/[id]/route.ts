import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFaixa } from "@/lib/safeScore";
import {
  calcularCompletudeMontador,
  normalizeEspecialidades,
} from "@/lib/montadorProfile";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;

    const montador = await prisma.montadorPerfil.findFirst({
      where: {
        OR: [{ id }, { userId: id }],
        ativo: true,
        user: { status: "ATIVO" },
      },
      select: {
        id: true,
        userId: true,
        bio: true,
        especialidades: true,
        anosExperiencia: true,
        cidade: true,
        estado: true,
        bairros: true,
        raioAtendimentoKm: true,
        fotoPerfil: true,
        portfolioFotos: true,
        precoBase: true,
        taxaMinima: true,
        cobraDeslocamento: true,
        observacaoPreco: true,
        valorACombinar: true,
        verificado: true,
        ativo: true,
        rating: true,
        totalServicos: true,
        user: {
          select: {
            id: true,
            nome: true,
            telefone: true,
            genero: true,
            status: true,
            avatarUrl: true,
            safeScore: { select: { score: true } },
            safeScoreProfile: { select: { currentScore: true, tier: true } },
          },
        },
      },
    });

    if (!montador) {
      return NextResponse.json({ ok: false, error: "Montador não encontrado." }, { status: 404 });
    }

    const especialidades = normalizeEspecialidades(montador.especialidades);
    const completude = calcularCompletudeMontador({
      nome: montador.user.nome,
      bio: montador.bio,
      especialidades,
      cidade: montador.cidade,
      estado: montador.estado,
      bairros: montador.bairros,
      ativo: montador.ativo,
      userStatus: montador.user.status,
    });
    const score = montador.user.safeScoreProfile?.currentScore ?? montador.user.safeScore?.score ?? 500;
    const faixa = getFaixa(score);

    return NextResponse.json({
      ok: true,
      montador: {
        ...montador,
        especialidades,
        profileCompleto: completude.completo,
        profileProgresso: completude.progresso,
        precoLabel: montador.valorACombinar
          ? "A combinar"
          : montador.precoBase
            ? `A partir de R$ ${(Number(montador.precoBase) / 100).toFixed(2).replace(".", ",")}`
            : "A combinar",
        safeScore: {
          score,
          faixa: faixa.label,
          cor: faixa.cor,
          bloqueado: faixa.bloqueado,
          tier: montador.user.safeScoreProfile?.tier ?? "BRONZE",
          totalServicos: montador.totalServicos,
          verificado: montador.verificado,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao carregar montador";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
