import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export const dynamic = "force-dynamic";

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  cidade: z.string().trim().min(2).max(80),
  estado: z.string().trim().min(2).max(2),
  bairro: z.string().trim().min(2).max(80).nullable().optional(),
  localizacaoPermitida: z.boolean(),
});

export async function PATCH(req: Request) {
  try {
    const auth = requireAuth(req);
    const parsed = locationSchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Dados de localização inválidos." },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const localizacao = {
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      cidadeAtual: data.cidade.trim(),
      estadoAtual: data.estado.trim().toUpperCase(),
      bairroAtual: data.bairro?.trim() || null,
      localizacaoPermitida: data.localizacaoPermitida,
      localizacaoAtualizadaEm: new Date(),
    };

    if (auth.role === "EMPREGADOR") {
      const perfil = await prisma.empregadorPerfil.upsert({
        where: { userId: auth.userId },
        update: localizacao,
        create: {
          userId: auth.userId,
          ...localizacao,
        },
        select: {
          cidadeAtual: true,
          estadoAtual: true,
          bairroAtual: true,
          latitude: true,
          longitude: true,
          localizacaoPermitida: true,
          localizacaoAtualizadaEm: true,
        },
      });

      return NextResponse.json({ ok: true, role: auth.role, localizacao: perfil });
    }

    if (auth.role === "MONTADOR") {
      const perfil = await prisma.montadorPerfil.upsert({
        where: { userId: auth.userId },
        update: localizacao,
        create: {
          userId: auth.userId,
          especialidades: [],
          bairros: [],
          portfolioFotos: [],
          ...localizacao,
        },
        select: {
          cidadeAtual: true,
          estadoAtual: true,
          bairroAtual: true,
          latitude: true,
          longitude: true,
          localizacaoPermitida: true,
          localizacaoAtualizadaEm: true,
        },
      });

      return NextResponse.json({ ok: true, role: auth.role, localizacao: perfil });
    }

    return NextResponse.json(
      { ok: false, error: "Localização ainda não está disponível para este perfil." },
      { status: 400 },
    );
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Erro ao salvar localização.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
