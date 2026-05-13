import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/montadores/buscar?cidade=...&uf=...&bairro=...&especialidade=...
 *
 * Stub mínimo do endpoint de busca de Montadores — espelha o contrato do
 * /api/diaristas/buscar mas filtra por MontadorPerfil em vez de DiaristaProfile.
 *
 * Decisões deliberadas neste stub:
 *  - O schema atual do MontadorPerfil ainda não tem MontadorBairro (como existe
 *    DiaristaBairro), então o filtro por bairro é nominal — comparamos a string
 *    `cidade` do perfil. TODO: criar MontadorBairro quando o fluxo de cadastro
 *    de área de atendimento do Montador estiver definido.
 *  - `especialidades` no schema é `String[]` (array Postgres). Filtramos via
 *    `hasSome` quando a especialidade é passada.
 *  - Retorna `{ ok, montadores }` pra espelhar o envelope do endpoint Diarista.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cidade = searchParams.get("cidade");
    const uf = searchParams.get("uf");
    const bairro = searchParams.get("bairro");
    const especialidade = searchParams.get("especialidade") || undefined;

    if (!cidade || !uf || !bairro) {
      return NextResponse.json(
        { error: "Informe cidade, uf e bairro" },
        { status: 400 },
      );
    }

    const montadores = await prisma.montadorPerfil.findMany({
      where: {
        ativo: true,
        verificado: true,
        ...(cidade ? { cidade: { equals: cidade, mode: "insensitive" } } : {}),
        ...(uf ? { estado: { equals: uf, mode: "insensitive" } } : {}),
        ...(especialidade
          ? { especialidades: { has: especialidade } }
          : {}),
      },
      select: {
        id: true,
        userId: true,
        bio: true,
        especialidades: true,
        anosExperiencia: true,
        cidade: true,
        estado: true,
        fotoPerfil: true,
        verificado: true,
        rating: true,
        totalServicos: true,
        user: {
          select: {
            id: true,
            nome: true,
            telefone: true,
            genero: true,
            avatarUrl: true,
          },
        },
      },
      take: 60,
    });

    // TODO (produto): filtro real por bairro quando MontadorBairro existir.
    void bairro;

    return NextResponse.json({ ok: true, montadores });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar montadores";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
