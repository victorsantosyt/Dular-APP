import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { aplicarEvento, getFaixa } from "@/lib/safeScore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Acesso negado" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => null);
    const resolucao = (body?.resolucao as string | undefined)?.toUpperCase();
    const observacao = (body?.observacao as string | undefined)?.trim();
    const allowed = ["CONFIRMADA", "ARQUIVADA"];

    if (!resolucao || !allowed.includes(resolucao)) {
      return NextResponse.json({ ok: false, error: "Resolução inválida" }, { status: 400 });
    }

    const incident = await prisma.incidentReport.update({
      where: { id },
      data: { resolucao: resolucao as "CONFIRMADA" | "ARQUIVADA" },
    });
    const userId = incident.reportedUserId;

    const antes = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } });

    if (resolucao === "CONFIRMADA") {
      await aplicarEvento(
        userId,
        "DENUNCIA_CONFIRMADA",
        incident.id,
        observacao ? `${observacao} gravidade=${incident.gravidade}` : `gravidade=${incident.gravidade}`,
      );
    } else {
      await aplicarEvento(userId, "DENUNCIA_ARQUIVADA", incident.id, observacao);
    }

    // Duas coisas diferentes vão para a tela do admin:
    //
    // - o score EXIBIDO, que vem do V2, a mesma fonte das leituras do app;
    // - se a conta foi SUSPENSA agora, lido do status do usuário. A suspensão
    //   automática abaixo de 200 continua decidida pelo score do legado, dentro
    //   de aplicarEvento, até existir uma PR própria para ela. Deduzir a
    //   suspensão do score exibido mostraria um aviso que não aconteceu (ou
    //   esconderia um que aconteceu) sempre que os ledgers divergirem.
    const [perfil, depois] = await Promise.all([
      prisma.safeScoreProfile.findUnique({ where: { userId }, select: { currentScore: true, tier: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { status: true } }),
    ]);
    const score = perfil?.currentScore ?? 500;

    return NextResponse.json({
      ok: true,
      safeScore: { score, tier: perfil?.tier ?? "BRONZE" },
      faixa: getFaixa(score),
      usuario: {
        status: depois?.status ?? null,
        suspensoAutomaticamente: antes?.status !== "BLOQUEADO" && depois?.status === "BLOQUEADO",
      },
    });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    if (e?.code === "P2025") {
      return NextResponse.json({ ok: false, error: "Incidente não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}
