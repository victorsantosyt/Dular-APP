import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFaixa } from "@/lib/safeScore";
import {
  calcularCompletudeMontador,
  normalizeEspecialidades,
  normalizeText,
} from "@/lib/montadorProfile";
// Gate do Guardian agora em memória na própria busca (sem N+1); ver abaixo.

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
        // Verificação no WHERE, não no `.filter()` abaixo. Dois motivos:
        //
        // 1. O `.filter()` roda DEPOIS do `take: 300`. Passando de 300
        //    montadores, os não verificados consumiriam slots do limite e
        //    esconderiam verificados — ninguém indevido aparecia, mas gente
        //    devida sumia.
        // 2. Filtro pós-query não se lê no `where`. Uma auditoria deste
        //    projeto concluiu que a busca de montadores NÃO filtrava
        //    verificação, justamente por olhar só aqui. O filtro existia,
        //    doze linhas abaixo. Regra que só se enxerga lendo o arquivo
        //    inteiro é regra que alguém vai contradizer.
        //
        // A conta de demonstração da revisão das lojas passa sem verificação
        // (ver lib/contaDemo.ts) — é o mesmo bypass já aplicado na busca de
        // diaristas, e sem ele o revisor não avalia o perfil montador.
        OR: [{ verificado: true }, { user: { is: { contaDemo: true } } }],
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
        // A verificação subiu para o `where` (ver comentário na query). O
        // `_diagnostico.verificado` continua no payload porque a tela de
        // diagnóstico do admin o consome.
        if (montador._diagnostico.completo) totalCompletos += 1;
        if (!montador._diagnostico.completo) return false;
        if (montador._diagnostico.localizacao) totalLocalizacao += 1;
        if (!montador._diagnostico.localizacao) return false;
        if (especialidadeNormalizada && !montador.especialidades.includes(especialidadeNormalizada)) return false;
        return true;
      })
      .map(({ _diagnostico, ...montador }) => montador);

    // T-18.6B: gate final do Guardian — em MEMÓRIA (elimina o N+1 de
    // getGuardianStatusForUser por candidato). Para os candidatos que chegam
    // aqui, o canAppearInSearch do Guardian se reduz a `!scoreBaixo`, porque
    // verificado, completo e ativo já foram garantidos no .filter acima, e
    // hardBan (SUSPEND/BLOCK)/shadow (SHADOW_BAN) já foram excluídos pelo where
    // (mesma condição de restrição ativa do getActiveRestrictions). O
    // `safeScore.bloqueado` já presente no objeto = getFaixa(score).bloqueado,
    // que o SCORE_BLOQUEIO (400) do Guardian espelha → !bloqueado equivale a
    // score >= SCORE_BLOQUEIO. Zero query adicional.
    const isDev = process.env.NODE_ENV !== "production";
    const liberados = publicos.filter((m) => m.safeScore.bloqueado === false);

    if (isDev) {
      console.log("[montadores/buscar]", {
        query: { cidade, uf, bairro },
        totalAntesFiltros: montadores.length,
        totalAtivos,
        totalCompletos,
        totalLocalizacao,
        totalGuardianOk: liberados.length,
      });
    }

    return NextResponse.json({
      ok: true,
      montadores: liberados,
    });
  } catch (err) {
    // A mensagem vai para o log, não para a resposta: erro do Prisma cita
    // tabela e coluna (ex.: "The column j0.contaDemo does not exist").
    console.error(err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
