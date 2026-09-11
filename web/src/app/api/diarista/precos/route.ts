import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { requireAuthAtivo, respostaDeSessao } from "@/lib/contaAtiva";
import { updatePrecosSchema } from "@/lib/schemas/diarista";
import { autoVerificarDiaristaSePossivel } from "@/lib/autoVerificacao";

async function handle(req: Request) {
  try {
    const auth = await requireAuthAtivo(req);
    if (auth.role !== "DIARISTA") {
      return NextResponse.json({ ok: false, error: "Apenas diarista." }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updatePrecosSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
    }

    const { precoLeve, precoMedio, precoPesada, bio } = parsed.data;

    const updated = await prisma.diaristaProfile.update({
      where: { userId: auth.userId },
      data: {
        precoLeve,
        precoMedio: precoMedio ?? undefined,
        precoPesada,
        bio: bio ?? undefined,
      },
    });

    // Auto-verificação lateral (silenciosa). Não derruba a request.
    try {
      await autoVerificarDiaristaSePossivel(auth.userId);
    } catch {
      // intencionalmente silencioso
    }

    return NextResponse.json({ ok: true, profile: updated });
  } catch (error: unknown) {
    const sessao = respostaDeSessao(error);
    if (sessao) return sessao;
    const message = error instanceof Error ? error.message : "Erro";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return handle(req);
}

export async function PUT(req: Request) {
  return handle(req);
}
