import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const auth = requireAuth(req);
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { id: true, nome: true, avatarUrl: true, role: true },
    });

    return NextResponse.json({ ok: true, user });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}
