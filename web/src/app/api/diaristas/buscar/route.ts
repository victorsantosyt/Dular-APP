import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SERVICOS_OFERECIDOS = ["DIARISTA", "BABA", "COZINHEIRA"] as const;
type ServicoOferecido = (typeof SERVICOS_OFERECIDOS)[number];

function parseServico(value: string | null): ServicoOferecido | null {
  if (value === "DIARISTA" || value === "BABA" || value === "COZINHEIRA") return value;
  return null;
}

export async function GET(req: Request) {
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

    const bairroDb = await prisma.bairro.findUnique({
      where: { nome_cidade_uf: { nome: bairro, cidade, uf } },
    });

    if (!bairroDb) {
      return NextResponse.json({ ok: true, diaristas: [] });
    }

    const diaristas = await prisma.diaristaProfile.findMany({
      where: {
        verificacao: "VERIFICADO",
        ...(servico ? { servicosOferecidos: { has: servico } } : {}),
        bairros: { some: { bairroId: bairroDb.id } },
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
      include: {
        user: { select: { id: true, nome: true, telefone: true } },
      },
      orderBy: [{ notaMedia: "desc" }, { totalServicos: "desc" }],
      take: 50,
    });

    return NextResponse.json({ ok: true, diaristas });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
