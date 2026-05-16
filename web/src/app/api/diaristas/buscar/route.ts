import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isDiaristaProfileCompleteForServico,
  getDiaristaProfileCompleteness,
  type ServicoOferecido,
} from "@/lib/diaristaProfile";

function parseServico(value: string | null): ServicoOferecido | null {
  if (value === "DIARISTA" || value === "BABA" || value === "COZINHEIRA") return value;
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

    if (!cidade || !uf || !bairro) {
      return NextResponse.json(
        { error: "Informe cidade, uf e bairro" },
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
    }

    const cidadeNorm = normalize(cidade);
    const ufNorm = normalize(uf);
    const bairroNorm = normalize(bairro);

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
            telefone: true,
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

    // Mantém shape compatível com o cliente atual (apenas reduz array).
    return NextResponse.json({ ok: true, diaristas });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
