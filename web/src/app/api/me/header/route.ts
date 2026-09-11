import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { requireAuthAtivo, respostaDeSessao } from "@/lib/contaAtiva";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const auth = await requireAuthAtivo(req);
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { id: true, nome: true, avatarUrl: true, role: true },
    });

    return NextResponse.json({ ok: true, user });
  } catch (e: any) {
    const sessao = respostaDeSessao(e);
    if (sessao) return sessao;
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}
