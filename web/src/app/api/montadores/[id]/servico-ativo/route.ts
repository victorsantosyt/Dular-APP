import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ACTIVE_MONTADOR_SERVICE_STATUSES = [
  "PENDENTE",
  "SOLICITADO",
  "ACEITO",
  "CONFIRMADO",
  "EM_ANDAMENTO",
  "AGUARDANDO_FINALIZACAO",
  "CONCLUIDO",
] as const;

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        status: string;
        tipo: string;
        categoria: string | null;
        data: Date;
        turno: string;
        cidade: string;
        uf: string;
        bairro: string;
        clientId: string;
        montadorId: string | null;
        createdAt: Date;
        updatedAt: Date;
      }>
    >(Prisma.sql`
      SELECT
        "id",
        "status"::text AS "status",
        "tipo"::text AS "tipo",
        "categoria"::text AS "categoria",
        "data",
        "turno"::text AS "turno",
        "cidade",
        "uf",
        "bairro",
        "clientId",
        "montadorId",
        "createdAt",
        "updatedAt"
      FROM "Servico"
      WHERE "montadorId" = ${id}
        AND "status"::text IN (${Prisma.join(ACTIVE_MONTADOR_SERVICE_STATUSES)})
      ORDER BY "createdAt" DESC
      LIMIT 1
    `);

    const servico = rows[0] ?? null;

    return NextResponse.json({
      ok: true,
      ativo: Boolean(servico),
      hasActiveService: Boolean(servico),
      servico,
      activeService: servico,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao verificar serviço ativo";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
