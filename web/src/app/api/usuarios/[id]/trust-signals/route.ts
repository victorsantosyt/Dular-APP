import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canReadScore, countCompletedServices, readScorePresentation } from "@/lib/safeScore/presentation";
import { getDiaristaVerificationStatus, getMontadorVerificationStatus, getEmpregadorVerificationStatus } from "@/lib/profileVerification";
import { requireAuthAtivo, respostaDeSessao } from "@/lib/contaAtiva";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const auth = await requireAuthAtivo(req);

    const { id } = await params;

    const [profile, reputation, user, totalServicos] = await Promise.all([
      prisma.safeScoreProfile.findUnique({
        where: { userId: id },
        select: { tier: true, lastRecalcAt: true },
      }),
      readScorePresentation(id),
      prisma.user.findUnique({
        where: { id },
        select: {
          emObservacao: true,
          role: true,
          id: true,
          diaristaProfile: { select: { verificacao: true } },
        },
      }),
      countCompletedServices(id),
    ]);

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    if (!(await canReadScore(auth, user))) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    if (!reputation) return NextResponse.json({ error: "SafeScore indisponível." }, { status: 503 });
    const identity = user.role === "DIARISTA" ? await getDiaristaVerificationStatus(id)
      : user.role === "MONTADOR" ? await getMontadorVerificationStatus(id)
      : user.role === "EMPREGADOR" ? await getEmpregadorVerificationStatus(id) : null;
    // NUNCA expor score numérico nem eventos do ledger
    return NextResponse.json({
      tier: reputation.tier,
      isVerified: identity === "VERIFICADO",
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
