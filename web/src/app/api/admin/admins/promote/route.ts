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

    const { telefone } = (await req.json()) as { telefone?: string };
    if (!telefone?.trim()) {
      return NextResponse.json({ ok: false, error: "Informe o telefone." }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { telefone: telefone.trim() },
      data: { role: "ADMIN" },
      select: { id: true, nome: true, telefone: true, email: true, role: true },
    });

    return NextResponse.json({ ok: true, user });
  } catch (e: any) {
    if (e?.code === "P2025") {
      return NextResponse.json({ ok: false, error: "Usuário não encontrado pelo telefone." }, { status: 404 });
    }
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}
