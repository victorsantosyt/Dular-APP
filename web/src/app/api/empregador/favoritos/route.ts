import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/requireAuth";

export const dynamic = "force-dynamic";

type FavoritoResponse = {
  id: string;
  tipo: "DIARISTA" | "MONTADOR";
  userId: string;
  nome: string;
  avatarUrl?: string | null;
  rating?: number | null;
  totalServicos?: number | null;
  cidade?: string | null;
  estado?: string | null;
  bairros?: string[];
  especialidades?: string[];
  precoLabel?: string | null;
  verificado?: boolean;
  profileCompleto?: boolean;
};

const createFavoritoSchema = z.object({
  profissionalUserId: z.string().min(1),
  tipo: z.enum(["DIARISTA", "MONTADOR"]),
});

const deleteFavoritoSchema = z.object({
  profissionalUserId: z.string().min(1),
  tipo: z.enum(["DIARISTA", "MONTADOR"]),
});

function checkDiaristaProfileCompleteness(profile: any): boolean {
  const required = profile.cidade && profile.estado && profile.servicosOferecidos?.length > 0;
  return !!required;
}

function checkMontadorProfileCompleteness(profile: any): boolean {
  const required = profile.cidade && profile.estado && profile.especialidades?.length > 0;
  return !!required;
}

async function enrichFavoritoData(favorito: any): Promise<FavoritoResponse | null> {
  const user = await prisma.user.findUnique({
    where: { id: favorito.profissionalUserId },
    select: {
      id: true,
      nome: true,
      avatarUrl: true,
    },
  });

  if (!user) {
    return null;
  }

  if (favorito.tipo === "DIARISTA") {
    const profile = await prisma.diaristaProfile.findUnique({
      where: { userId: favorito.profissionalUserId },
      select: {
        notaMedia: true,
        totalServicos: true,
        cidade: true,
        estado: true,
        verificacao: true,
        servicosOferecidos: true,
      },
    });

    return {
      id: favorito.id,
      tipo: "DIARISTA" as const,
      userId: user.id,
      nome: user.nome,
      avatarUrl: user.avatarUrl,
      rating: profile?.notaMedia ?? undefined,
      totalServicos: profile?.totalServicos ?? undefined,
      cidade: profile?.cidade ?? undefined,
      estado: profile?.estado ?? undefined,
      especialidades: profile?.servicosOferecidos?.length ? profile.servicosOferecidos : undefined,
      verificado: profile?.verificacao === "VERIFICADO",
      profileCompleto: profile ? checkDiaristaProfileCompleteness(profile) : false,
    };
  } else {
    const profile = await prisma.montadorPerfil.findUnique({
      where: { userId: favorito.profissionalUserId },
      select: {
        bairros: true,
        especialidades: true,
        cidade: true,
        estado: true,
      },
    });

    return {
      id: favorito.id,
      tipo: "MONTADOR" as const,
      userId: user.id,
      nome: user.nome,
      avatarUrl: user.avatarUrl,
      cidade: profile?.cidade ?? undefined,
      estado: profile?.estado ?? undefined,
      bairros: profile?.bairros?.length ? profile.bairros : undefined,
      especialidades: profile?.especialidades?.length ? profile.especialidades : undefined,
      profileCompleto: profile ? checkMontadorProfileCompleteness(profile) : false,
    };
  }
}

export async function GET(req: Request) {
  try {
    const auth = requireRole(req, ["EMPREGADOR"]);

    const favoritos = await prisma.empregadorFavorito.findMany({
      where: { empregadorUserId: auth.userId },
      orderBy: { createdAt: "desc" },
    });

    const favoritosEnriquecidos: (FavoritoResponse | null)[] = await Promise.all(
      favoritos.map((fav) => enrichFavoritoData(fav))
    );

    const resultados = favoritosEnriquecidos.filter((f): f is FavoritoResponse => f !== null);

    return NextResponse.json({
      ok: true,
      favoritos: resultados,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ ok: false, error: "Acesso negado" }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Erro";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = requireRole(req, ["EMPREGADOR"]);
    const body = await req.json();

    const data = createFavoritoSchema.parse(body);

    if (data.profissionalUserId === auth.userId) {
      return NextResponse.json(
        { ok: false, error: "Não é possível favoritar a si mesmo" },
        { status: 403 }
      );
    }

    const profissional = await prisma.user.findUnique({
      where: { id: data.profissionalUserId },
      select: { id: true, role: true },
    });

    if (!profissional) {
      return NextResponse.json(
        { ok: false, error: "Profissional não encontrado" },
        { status: 404 }
      );
    }

    if (data.tipo === "DIARISTA" && profissional.role !== "DIARISTA") {
      return NextResponse.json(
        { ok: false, error: "Tipo inválido para este profissional" },
        { status: 400 }
      );
    }

    if (data.tipo === "MONTADOR" && profissional.role !== "MONTADOR") {
      return NextResponse.json(
        { ok: false, error: "Tipo inválido para este profissional" },
        { status: 400 }
      );
    }

    const favorito = await prisma.empregadorFavorito.upsert({
      where: {
        empregadorUserId_profissionalUserId_tipo: {
          empregadorUserId: auth.userId,
          profissionalUserId: data.profissionalUserId,
          tipo: data.tipo as any,
        },
      },
      update: {},
      create: {
        empregadorUserId: auth.userId,
        profissionalUserId: data.profissionalUserId,
        tipo: data.tipo as any,
      },
    });

    const enriched = await enrichFavoritoData(favorito);
    if (!enriched) {
      return NextResponse.json(
        { ok: false, error: "Erro ao buscar dados do profissional" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        favorito: enriched,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Dados inválidos" },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ ok: false, error: "Acesso negado" }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Erro";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = requireRole(req, ["EMPREGADOR"]);
    
    const url = new URL(req.url);
    const profissionalUserId = url.searchParams.get("profissionalUserId");
    const tipo = url.searchParams.get("tipo");

    let deleteData;
    if (!profissionalUserId || !tipo) {
      const body = await req.json();
      deleteData = deleteFavoritoSchema.parse(body);
    } else {
      deleteData = { profissionalUserId, tipo: tipo as "DIARISTA" | "MONTADOR" };
    }

    await prisma.empregadorFavorito.delete({
      where: {
        empregadorUserId_profissionalUserId_tipo: {
          empregadorUserId: auth.userId,
          profissionalUserId: deleteData.profissionalUserId,
          tipo: deleteData.tipo as any,
        },
      },
    });

    return NextResponse.json({
      ok: true,
    });
  } catch (error: unknown) {
    if (error instanceof Error && (error as any).code === "P2025") {
      return NextResponse.json({ ok: true });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Dados inválidos" },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ ok: false, error: "Acesso negado" }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Erro";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
