import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAtivo, respostaDeSessao } from "@/lib/contaAtiva";
import { getDiaristaVerificationStatus, getEmpregadorVerificationStatus, getMontadorVerificationStatus } from "@/lib/profileVerification";
import { countCompletedServices, readScorePresentation, SAFE_SCORE_GUIDE } from "@/lib/safeScore/presentation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const auth = await requireAuthAtivo(req);
    const verification = auth.role === "DIARISTA" ? getDiaristaVerificationStatus
      : auth.role === "MONTADOR" ? getMontadorVerificationStatus
      : auth.role === "EMPREGADOR" ? getEmpregadorVerificationStatus : null;
    if (!verification) return NextResponse.json({ error: "Perfil não suportado." }, { status: 403 });
    const [reputation, totalServicos, identidade, user, restrictions] = await Promise.all([
      readScorePresentation(auth.userId), countCompletedServices(auth.userId), verification(auth.userId),
      prisma.user.findUnique({ where: { id: auth.userId }, select: { emObservacao: true } }),
      prisma.userRestriction.findMany({ where: {
        userId: auth.userId, revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      }, select: { type: true } }),
    ]);
    const restrito = restrictions.length > 0;
    const status = restrito ? "Conta com restrições" : reputation?.bloqueado ? reputation.faixa
      : user?.emObservacao ? "Em Observação" : reputation?.faixa ?? null;
    const mensagem = restrito || reputation?.bloqueado
      ? "Há limitações de uso da plataforma. Consulte o suporte para orientações sobre sua conta."
      : status === "Em Observação"
        ? "Sua reputação está em observação. Acompanhe os detalhes do seu perfil."
        : reputation ? "Este indicador reflete o histórico do seu perfil na plataforma. Não é uma garantia de segurança."
        : "Ainda não há um cálculo de reputação disponível para seu perfil.";
    return NextResponse.json({
      status, mensagem, restrito,
      reputation: reputation ? { ...reputation, status, restrito,
        mensagem,
      } : null,
      totalServicos, identidade, guide: SAFE_SCORE_GUIDE,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return respostaDeSessao(error) ?? NextResponse.json({ error: "Não foi possível consultar seu SafeScore." }, { status: 500 });
  }
}
