import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { requireAuthAtivo, respostaDeSessao } from "@/lib/contaAtiva";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const t0 = Date.now();
  const isDev = process.env.NODE_ENV === "development";
  try {
    const tAuth = Date.now();
    const auth = await requireAuthAtivo(req);
    if (isDev) console.log(`[me/restrictions GET] auth: ${Date.now() - tAuth}ms`);

    const tQuery = Date.now();
    const restrictions = await prisma.userRestriction.findMany({
      where: {
        userId: auth.userId,
        revokedAt: null,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      select: {
        id: true,
        type: true,
        reason: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    if (isDev) console.log(`[me/restrictions GET] query: ${Date.now() - tQuery}ms`);

    if (isDev) console.log(`[me/restrictions GET] TOTAL: ${Date.now() - t0}ms`);
    return NextResponse.json({ restrictions });
  } catch (e: any) {
    if (isDev) console.log(`[me/restrictions GET] ERROR after ${Date.now() - t0}ms: ${e?.message}`);
    const sessao = respostaDeSessao(e);
    if (sessao) return sessao;
    return NextResponse.json({ error: e?.message ?? "Erro" }, { status: 500 });
  }
}
