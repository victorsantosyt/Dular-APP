import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFaixa } from "@/lib/safeScore";
import {
  calcularCompletudeMontador,
  normalizeEspecialidades,
  normalizeText,
} from "@/lib/montadorProfile";
import { getGuardianStatusForUser } from "@/lib/safeScoreGuardian";

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

    if (!cidade || !uf) {
      return NextResponse.json(
        { error: "Informe cidade e uf" },
        { status: 400 },
      );
    }

    // T-18.6: Guardian exige que ações sensíveis bloqueiem profissionais
    // sob restrições ativas. Aqui filtramos a busca para excluir montadores
    // com SHADOW_BAN/SUSPEND/BLOCK ativos. Mantém ordenação e shape do
    // payload originais (verificado=true continua sendo filtrado no .filter
    // mais abaixo, junto da localização/completude).
    const now = new Date();
    const montadores = await prisma.montadorPerfil.findMany({
      where: {
        user: {
          is: {
            restrictions: {
              none: {
                type: { in: ["SHADOW_BAN", "SUSPEND", "BLOCK"] },
                revokedAt: null,
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
              },
            },
          },
        },
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
        atendeTodaCidade: true,
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
            genero: true,
            status: true,
            avatarUrl: true,
            safeScore: { select: { score: true } },
            safeScoreProfile: { select: { currentScore: true, tier: true } },
          },
        },
      },
      take: 300,
    });

    const cidadeBusca = normalizeText(cidade);
    const ufBusca = normalizeText(uf);
    const bairroBusca = normalizeText(bairro);
    let totalAtivos = 0;
    let totalCompletos = 0;
    let totalLocalizacao = 0;

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
          atendeTodaCidade: montador.atendeTodaCidade,
          ativo: montador.ativo,
          userStatus: montador.user.status,
        });
        const score = montador.user.safeScoreProfile?.currentScore ?? montador.user.safeScore?.score ?? 500;
        const faixa = getFaixa(score);
        const publicUser = {
          id: montador.user.id,
          nome: montador.user.nome,
          genero: montador.user.genero,
          status: montador.user.status,
          avatarUrl: montador.user.avatarUrl,
        };
        const cidadeNormalizada = normalizeText(montador.cidade);
        const ufNormalizada = normalizeText(montador.estado);
        const bairrosNormalizados = montador.bairros.map((item) => normalizeText(item));
        return {
          ...montador,
          user: publicUser,
          nome: montador.user.nome,
          apresentacao: montador.bio,
          avatarUrl: montador.fotoPerfil ?? montador.user.avatarUrl,
          uf: montador.estado,
          especialidades,
          profileCompleto: completude.completo,
          perfilCompleto: completude.completo,
          profileProgresso: completude.progresso,
          precoLabel: montador.valorACombinar
            ? "A combinar"
            : montador.precoBase
              ? `A partir de R$ ${(Number(montador.precoBase) / 100).toFixed(2).replace(".", ",")}`
              : "A combinar",
          safeScore: {
            faixa: faixa.label,
            cor: faixa.cor,
            bloqueado: faixa.bloqueado,
            tier: montador.user.safeScoreProfile?.tier ?? "BRONZE",
            totalServicos: montador.totalServicos,
            verificado: montador.verificado,
          },
          _diagnostico: {
            ativo: montador.ativo === true && montador.user.status === "ATIVO",
            completo: completude.completo,
            verificado: montador.verificado === true,
            localizacao:
              cidadeNormalizada === cidadeBusca &&
              ufNormalizada === ufBusca &&
              (!bairroBusca || montador.atendeTodaCidade || bairrosNormalizados.includes(bairroBusca)),
          },
        };
      })
      .filter((montador) => {
        if (montador._diagnostico.ativo) totalAtivos += 1;
        if (!montador._diagnostico.ativo) return false;
        // T-18.6: Guardian exige verificado=true para aparecer na busca.
        if (!montador._diagnostico.verificado) return false;
        if (montador._diagnostico.completo) totalCompletos += 1;
        if (!montador._diagnostico.completo) return false;
        if (montador._diagnostico.localizacao) totalLocalizacao += 1;
        if (!montador._diagnostico.localizacao) return false;
        if (especialidadeNormalizada && !montador.especialidades.includes(especialidadeNormalizada)) return false;
        return true;
      })
      .map(({ _diagnostico, ...montador }) => montador);

    // T-18.6B: gate final do Guardian. Filtros anteriores (restrições no
    // DB + verificado + ativo + completude + localização) já reduziram o
    // conjunto. Aqui aplicamos `canAppearInSearch` para cobrir SafeScore
    // baixo e qualquer regra futura do Guardian.
    const isDev = process.env.NODE_ENV !== "production";
    const guardianResults = await Promise.all(
      publicos.map(async (montador) => ({
        montador,
        guardian: await getGuardianStatusForUser(montador.userId).catch(() => null),
      })),
    );
    const liberados = guardianResults.filter(
      (r) => r.guardian?.canAppearInSearch === true,
    );

    if (isDev) {
      console.log("[montadores/buscar]", {
        query: { cidade, uf, bairro },
        totalAntesFiltros: montadores.length,
        totalAtivos,
        totalCompletos,
        totalLocalizacao,
        totalGuardianOk: liberados.length,
      });
      const blocked = guardianResults.filter(
        (r) => r.guardian?.canAppearInSearch !== true,
      );
      blocked.forEach((r) => {
        console.log(
          `[guardian/search] rejeitado userId=${r.montador.userId} motivos=${(r.guardian?.motivos ?? ["guardian_indisponivel"]).join(",")}`,
        );
      });
    }

    return NextResponse.json({
      ok: true,
      montadores: liberados.map((r) => r.montador),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar montadores";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
