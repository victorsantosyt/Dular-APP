import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  isDiaristaProfileCompleteForServico,
  getDiaristaProfileCompleteness,
  type ServicoOferecido,
} from "@/lib/diaristaProfile";
import { getGuardianStatusForUser } from "@/lib/safeScoreGuardian";

function parseServico(value: string | null): ServicoOferecido | null {
  if (
    value === "DIARISTA" ||
    value === "BABA" ||
    value === "COZINHEIRA" ||
    value === "FAXINEIRA" ||
    value === "PASSADEIRA" ||
    value === "LAVADEIRA" ||
    value === "CUIDADORA"
  ) {
    return value;
  }
  return null;
}

/**
 * Normaliza string para comparação tolerante: remove acentos, espaços extras,
 * lowercase, e (opcionalmente) sufixos entre parênteses. O frontend pode mandar
 * `bairro=Água Boa (Mato Grosso)` (com nome da UF no parêntese), enquanto a
 * tabela `Bairro` armazena só `Água Boa` — normalizamos os dois lados.
 */
function normalize(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export async function GET(req: Request) {
  const isDev = process.env.NODE_ENV === "development";
  try {
    const { searchParams } = new URL(req.url);
    const cidade = searchParams.get("cidade");
    const uf = searchParams.get("uf");
    const bairro = searchParams.get("bairro");
    const tipo = searchParams.get("tipo") || undefined;
    const categoria = searchParams.get("categoria") || undefined;
    const servicoParam = searchParams.get("servico");
    const servico = parseServico(servicoParam);

    if (!cidade || !uf) {
      return NextResponse.json(
        { error: "Informe cidade e uf" },
        { status: 400 }
      );
    }
    if (servicoParam && !servico) {
      return NextResponse.json({ error: "Serviço inválido." }, { status: 400 });
    }
    if (categoria && !tipo && !servico) {
      return NextResponse.json({ error: "Informe tipo ao usar categoria." }, { status: 400 });
    }

    if (isDev) {
      console.log(`[diaristas/buscar] query:`, { cidade, uf, bairro, servico, tipo, categoria });

      // Sub-contadores DEV: ajudam a localizar exatamente qual filtro está
      // excluindo profissionais. Cada query é independente para que o efeito
      // de cada cláusula (ativo, user.status, verificacao, servicosOferecidos)
      // possa ser inspecionado em isolado nos logs.
      try {
        const countTotal = await prisma.diaristaProfile.count({ where: {} });
        console.log(`[diaristas/buscar] DEBUG: countTotal=${countTotal}`);

        const countAtivo = await prisma.diaristaProfile.count({
          where: { ativo: true },
        });
        console.log(`[diaristas/buscar] DEBUG: countAtivo=${countAtivo}`);

        const countComUserAtivo = await prisma.diaristaProfile.count({
          where: { ativo: true, user: { is: { status: "ATIVO" } } },
        });
        console.log(`[diaristas/buscar] DEBUG: countComUserAtivo=${countComUserAtivo}`);

        const countVerificada = await prisma.diaristaProfile.count({
          where: { ativo: true, verificacao: "VERIFICADO" },
        });
        console.log(`[diaristas/buscar] DEBUG: countVerificada=${countVerificada}`);

        if (servico) {
          const countComServico = await prisma.diaristaProfile.count({
            where: { ativo: true, servicosOferecidos: { has: servico } },
          });
          console.log(
            `[diaristas/buscar] DEBUG: countComServico(${servico})=${countComServico}`,
          );
        }
      } catch (e) {
        console.log(`[diaristas/buscar] DEBUG counters falhou:`, e);
      }
    }

    const cidadeNorm = normalize(cidade);
    const ufNorm = normalize(uf);
    const bairroNorm = normalize(bairro);

    // T-18.6: filtro adicional do Guardian — excluir profissionais com
    // restrições ativas (SHADOW_BAN, SUSPEND, BLOCK) e que ainda não
    // expiraram. LIMIT_BOOKINGS não bloqueia visibilidade (afeta criação
    // do empregador, não a busca do profissional). Espelha a regra de
    // `canAppearInSearch` em safeScoreGuardian.ts.
    // Sem `as const`: Prisma exige `UserRestrictionType[]` mutável, e o
    // `as const` quebrava a inferência de tipo do `findMany` inteiro.
    const restrictionFilter: Prisma.UserRestrictionListRelationFilter = {
      none: {
        type: { in: ["SHADOW_BAN", "SUSPEND", "BLOCK"] },
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    };

    // Query mínima no banco: filtramos `ativo`, `verificado`, nicho e
    // `user.status`/`tipo` via Prisma. A comparação de cidade/UF/bairro é
    // feita em memória para usar normalização (case + acentos + sufixos
    // entre parênteses) consistente com o que o app envia.
    const diaristasRaw = await prisma.diaristaProfile.findMany({
      where: {
        ativo: true,
        verificacao: "VERIFICADO",
        ...(servico ? { servicosOferecidos: { has: servico } } : {}),
        user: {
          is: {
            status: "ATIVO",
            restrictions: restrictionFilter,
            ...(tipo
              ? {
                  habilidades: {
                    some: {
                      tipo: tipo as any,
                      ...(categoria ? { categoria: categoria as any } : {}),
                    },
                  },
                }
              : {}),
          },
        },
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
        precoBabaHora: true,
        precoCozinheiraBase: true,
        taxaMinima: true,
        valorACombinar: true,
        bairros: {
          select: {
            id: true,
            bairroId: true,
            bairro: { select: { nome: true, cidade: true, uf: true } },
          },
        },
        user: {
          select: {
            id: true,
            nome: true,
            status: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [{ notaMedia: "desc" }, { totalServicos: "desc" }],
      take: 300,
    });

    if (isDev) {
      console.log(`[diaristas/buscar] totalAntesFiltros: ${diaristasRaw.length}`);
    }

    // 1) Filtro de localização (cidade/uf normalizados + bairro opcional
    // quando atendeTodaCidade=true).
    //
    // Aceita também perfis cujo `DiaristaProfile.cidade/estado` esteja vazio
    // mas que tenham ao menos um bairro vinculado cuja cidade/uf casa com a
    // busca — alinhamento com a completude do mobile, que permite áreas de
    // atendimento via bairros sem cidade/estado direto.
    const comLocalizacao = diaristasRaw.filter((p) => {
      const cidadePerfil = normalize(p.cidade);
      const ufPerfil = normalize(p.estado);
      const cidadeMatchDireto = !!cidadePerfil && cidadePerfil === cidadeNorm;
      const ufMatchDireto = !!ufPerfil && ufPerfil === ufNorm;

      const bairrosMatchCidadeUf = p.bairros.filter((db) => {
        const bc = normalize(db.bairro?.cidade);
        const bu = normalize(db.bairro?.uf);
        return bc === cidadeNorm && bu === ufNorm;
      });

      const cidadeUfMatch =
        (cidadeMatchDireto && ufMatchDireto) || bairrosMatchCidadeUf.length > 0;
      if (!cidadeUfMatch) return false;

      // Bairro é opcional quando o perfil atende toda a cidade.
      if (p.atendeTodaCidade) return true;

      // Sem filtro de bairro efetivo (normalizado vazio) — passa direto.
      if (!bairroNorm) return true;

      // Caso geral: confere se algum bairro vinculado bate com o nome buscado
      // (ignorando acentos/case e o sufixo entre parênteses que o app costuma
      // anexar — ex.: "Água Boa (Mato Grosso)").
      return bairrosMatchCidadeUf.some(
        (db) => normalize(db.bairro?.nome) === bairroNorm,
      );
    });

    if (isDev) {
      console.log(`[diaristas/buscar] totalLocalizacao: ${comLocalizacao.length}`);
    }

    // 2) Filtro de completude (já alinhado entre backend e mobile via
    // getDiaristaProfileCompleteness — localização aceita fallback de bairros).
    const rejeitados: Array<{ userId: string; motivos: string[] }> = [];
    const diaristas = comLocalizacao.filter((p) => {
      const profileForCheck = {
        ativo: p.ativo,
        bio: p.bio,
        servicosOferecidos: p.servicosOferecidos,
        cidade: p.cidade,
        estado: p.estado,
        atendeTodaCidade: p.atendeTodaCidade,
        raioAtendimentoKm: p.raioAtendimentoKm,
        precoLeve: p.precoLeve,
        precoMedio: p.precoMedio,
        precoPesada: p.precoPesada,
        precoBabaHora: p.precoBabaHora,
        precoCozinheiraBase: p.precoCozinheiraBase,
        taxaMinima: p.taxaMinima,
        valorACombinar: p.valorACombinar,
        bairros: p.bairros,
        user: p.user ? { nome: p.user.nome, status: p.user.status } : null,
      };
      const result = servico
        ? isDiaristaProfileCompleteForServico(profileForCheck, servico)
        : getDiaristaProfileCompleteness(profileForCheck);
      if (!result.completo) {
        rejeitados.push({ userId: p.userId, motivos: result.motivos });
      }
      return result.completo;
    });

    if (isDev) {
      console.log(`[diaristas/buscar] totalCompletos: ${diaristas.length}`);
      rejeitados.forEach((r) => {
        console.log(
          `[diaristas/buscar] rejeitado userId=${r.userId} motivos=${r.motivos.join(",")}`,
        );
      });
    }

    // T-18.6B: gate final do Guardian. Os filtros anteriores (verificacao,
    // restrições, localização, completude) já encolheram o conjunto; aqui
    // rodamos getGuardianStatusForUser para cada candidato e descartamos
    // quem não tiver `canAppearInSearch === true` (cobre SafeScore < 400 e
    // qualquer outra regra futura). Paralelo via Promise.all; o `take: 300`
    // do DB + filtros locais mantêm o N controlado.
    const guardianResults = await Promise.all(
      diaristas.map(async (p) => ({
        diarista: p,
        guardian: await getGuardianStatusForUser(p.userId).catch(() => null),
      })),
    );
    const liberadas = guardianResults.filter(
      (r) => r.guardian?.canAppearInSearch === true,
    );

    if (isDev) {
      const blocked = guardianResults.filter(
        (r) => r.guardian?.canAppearInSearch !== true,
      );
      blocked.forEach((r) => {
        console.log(
          `[guardian/search] rejeitado userId=${r.diarista.userId} motivos=${(r.guardian?.motivos ?? ["guardian_indisponivel"]).join(",")}`,
        );
      });
      console.log(
        `[diaristas/buscar] totalGuardianOk: ${liberadas.length} / ${guardianResults.length}`,
      );
    }

    // Mantém shape compatível com o cliente atual (apenas reduz array).
    return NextResponse.json({
      ok: true,
      diaristas: liberadas.map((r) => r.diarista),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
