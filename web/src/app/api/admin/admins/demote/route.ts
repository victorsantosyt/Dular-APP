import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { userId } = (await req.json()) as { userId?: string };
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Informe o userId." }, { status: 400 });
    }

    if (userId === auth.userId) {
      return NextResponse.json({ ok: false, error: "Você não pode remover a si mesmo." }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role: "CLIENTE" },
      select: { id: true, nome: true, telefone: true, email: true, role: true },
    });

    return NextResponse.json({ ok: true, user });
  } catch (e: any) {
    if (e?.code === "P2025") {
      return NextResponse.json({ ok: false, error: "Usuário não encontrado." }, { status: 404 });
    }
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}
