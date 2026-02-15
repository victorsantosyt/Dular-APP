import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const telefone = String(body?.telefone || "").trim();
    const senha = String(body?.senha || "");

    if (!telefone) return NextResponse.json({ ok: false, error: "Informe o usuário (telefone)." }, { status: 400 });
    if (!senha || senha.length < 6) return NextResponse.json({ ok: false, error: "Senha fraca (mínimo 6)." }, { status: 400 });

    const senhaHash = await bcrypt.hash(senha, 10);

    const user = await prisma.user.upsert({
      where: { telefone },
      update: { role: "ADMIN", senhaHash },
      create: { telefone, role: "ADMIN", senhaHash, nome: telefone },
      select: { id: true, telefone: true, role: true },
    });

    return NextResponse.json({ ok: true, user });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}
