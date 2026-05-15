import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export const dynamic = "force-dynamic";

const SERVICOS_PERMITIDOS = ["DIARISTA", "BABA", "COZINHEIRA"];

export async function GET(req: Request) {
  const t0 = Date.now();
  const isDev = process.env.NODE_ENV === "development";
  try {
    const tAuth = Date.now();
    const auth = requireAuth(req);
    if (isDev) console.log(`[diarista/me GET] auth: ${Date.now() - tAuth}ms`);
    if (auth.role !== "DIARISTA") {
      return NextResponse.json({ ok: false, error: "Apenas diarista." }, { status: 403 });
    }

    // Antes: include pesado com nested include em bairros -> N+1.
    // Agora: select específico das colunas necessárias e os relacionamentos
    // achatados (sem nested include). Reduz fortemente o payload e o tempo.
    const tQuery = Date.now();
    const profile = await prisma.diaristaProfile.findUnique({
      where: { userId: auth.userId },
      select: {
        id: true,
        userId: true,
        verificacao: true,
        ativo: true,
        fotoUrl: true,
        docUrl: true,
        bio: true,
        precoLeve: true,
        precoMedio: true,
        precoPesada: true,
        notaMedia: true,
        totalServicos: true,
        servicosOferecidos: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, nome: true, telefone: true, status: true } },
        agenda: {
          select: {
            id: true,
            diaSemana: true,
            turno: true,
            ativo: true,
          },
        },
        bairros: {
          select: {
            id: true,
            bairroId: true,
            bairro: {
              select: { id: true, nome: true, cidade: true, uf: true },
            },
          },
        },
      },
    });

    if (isDev) console.log(`[diarista/me GET] profile query: ${Date.now() - tQuery}ms`);

    if (!profile) {
      return NextResponse.json({ ok: false, error: "Perfil não encontrado." }, { status: 404 });
    }

    if (isDev) console.log(`[diarista/me GET] TOTAL: ${Date.now() - t0}ms`);
    return NextResponse.json({ ok: true, profile });
  } catch (error: unknown) {
    if (isDev) {
      const msg = error instanceof Error ? error.message : "unknown";
      console.log(`[diarista/me GET] ERROR after ${Date.now() - t0}ms: ${msg}`);
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Erro";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "DIARISTA") {
      return NextResponse.json({ ok: false, error: "Apenas diarista." }, { status: 403 });
    }

    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (Array.isArray(body.servicosOferecidos)) {
      const invalid = body.servicosOferecidos.filter(
        (v: unknown) => typeof v !== "string" || !SERVICOS_PERMITIDOS.includes(v),
      );
      if (invalid.length > 0) {
        return NextResponse.json(
          { ok: false, error: `Valores inválidos: ${invalid.join(", ")}` },
          { status: 400 },
        );
      }
      data.servicosOferecidos = body.servicosOferecidos;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: "Nenhum campo para atualizar." }, { status: 400 });
    }

    const profile = await prisma.diaristaProfile.update({
      where: { userId: auth.userId },
      data,
    });

    return NextResponse.json({ ok: true, profile });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Erro";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
