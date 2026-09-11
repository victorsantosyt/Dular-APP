import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { requireAuthAtivo, respostaDeSessao } from "@/lib/contaAtiva";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    await requireAuthAtivo(req); // qualquer usuário autenticado — sem checagem de role

    const { id } = await params;

    const [profile, user, totalServicos] = await Promise.all([
      prisma.safeScoreProfile.findUnique({
        where: { userId: id },
        select: { tier: true, lastRecalcAt: true },
      }),
      prisma.user.findUnique({
        where: { id },
        select: {
          emObservacao: true,
          diaristaProfile: { select: { verificacao: true } },
        },
      }),
      prisma.servico.count({
        where: {
          OR: [{ clientId: id }, { diaristaId: id }],
          status: "CONFIRMADO",
        },
      }),
    ]);

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    // NUNCA expor score numérico nem eventos do ledger
    return NextResponse.json({
      tier: profile?.tier ?? "BRONZE",
      isVerified: user.diaristaProfile?.verificacao === "VERIFICADO",
      totalServicos,
      emObservacao: user.emObservacao ?? false,
      lastUpdated: profile?.lastRecalcAt ?? null,
    });
  } catch (e: any) {
    const sessao = respostaDeSessao(e);
    if (sessao) return sessao;
    return NextResponse.json({ error: e?.message ?? "Erro" }, { status: 500 });
  }
}
