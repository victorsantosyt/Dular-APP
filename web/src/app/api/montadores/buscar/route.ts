import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFaixa } from "@/lib/safeScore";
import {
  calcularCompletudeMontador,
  normalizeEspecialidades,
  normalizeText,
} from "@/lib/montadorProfile";

export const dynamic = "force-dynamic";

/**
 * GET /api/montadores/buscar?cidade=...&uf=...&bairro=...&especialidade=...
 *
 * Busca pública do Montador: retorna somente perfis ativos e completos.
 * O campo `userId` é o ID usado pelo mobile como `montadorUserId` no POST
 * /api/servicos.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cidade = searchParams.get("cidade");
    const uf = searchParams.get("uf");
    const bairro = searchParams.get("bairro");
    const especialidade = searchParams.get("especialidade") || undefined;
    const especialidadeNormalizada = especialidade ? normalizeEspecialidades([especialidade])[0] : undefined;

    if (!cidade || !uf || !bairro) {
      return NextResponse.json(
        { error: "Informe cidade, uf e bairro" },
        { status: 400 },
      );
    }

    const montadores = await prisma.montadorPerfil.findMany({
      where: {
        ativo: true,
        ...(cidade ? { cidade: { equals: cidade, mode: "insensitive" } } : {}),
        ...(uf ? { estado: { equals: uf, mode: "insensitive" } } : {}),
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
      take: 60,
    });

    const bairroBusca = normalizeText(bairro);
    const publicos = montadores
      .map((montador) => {
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
        return {
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
        };
      })
      .filter((montador) => {
        if (!montador.profileCompleto) return false;
        if (especialidadeNormalizada && !montador.especialidades.includes(especialidadeNormalizada)) return false;
        if (bairroBusca && !montador.bairros.some((item) => normalizeText(item) === bairroBusca)) return false;
        return true;
      });

    return NextResponse.json({ ok: true, montadores: publicos });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar montadores";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
