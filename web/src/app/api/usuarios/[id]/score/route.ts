import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { getFaixa } from "@/lib/safeScore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    requireAuth(req);

    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        diaristaProfile: {
          select: {
            totalServicos: true,
            verificacao: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: "Usuário não encontrado" }, { status: 404 });
    }

    // Dual-read: SafeScoreProfile (novo) com fallback para SafeScore (legado)
    let score = 500;
    let tier = "BRONZE";

    const profile = await prisma.safeScoreProfile.findUnique({
      where: { userId: id },
      select: { currentScore: true, tier: true },
    });

    if (profile) {
      score = profile.currentScore;
      tier = profile.tier;
    } else {
      const legacy = await prisma.safeScore.findUnique({
        where: { userId: id },
        select: { score: true },
      });
      if (legacy) score = legacy.score;
    }

    const totalServicos =
      user.diaristaProfile?.totalServicos ??
      (await prisma.servico.count({
        where: {
          status: "FINALIZADO",
          OR: [{ clientId: id }, { diaristaId: id }],
        },
      }));

    const faixaData = getFaixa(score);

    return NextResponse.json({
      faixa: faixaData.label,
      cor: faixaData.cor,
      bloqueado: faixaData.bloqueado,
      tier,
      totalServicos,
      verificado: user.diaristaProfile?.verificacao === "VERIFICADO",
    });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}
