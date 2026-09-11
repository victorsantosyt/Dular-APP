import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { requireAuthAtivo, respostaDeSessao } from "@/lib/contaAtiva";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const auth = await requireAuthAtivo(req);
    const { pushToken } = (await req.json()) as { pushToken?: string };

    if (!pushToken || typeof pushToken !== "string") {
      return NextResponse.json({ ok: false, error: "pushToken inválido." }, { status: 400 });
    }

    if (!pushToken.startsWith("ExponentPushToken[")) {
      return NextResponse.json({ ok: false, error: "Formato de token inválido." }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: auth.userId },
      data: { pushToken },
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    const sessao = respostaDeSessao(e);
    if (sessao) return sessao;
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
