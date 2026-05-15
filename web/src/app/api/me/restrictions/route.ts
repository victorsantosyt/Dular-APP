import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const t0 = Date.now();
  const isDev = process.env.NODE_ENV === "development";
  try {
    const tAuth = Date.now();
    const auth = requireAuth(req);
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
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: e?.message ?? "Erro" }, { status: 500 });
  }
}
