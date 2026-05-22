import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAuth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const promoteAdminSchema = z.object({
  telefone: z.string().trim().min(10).max(20),
});

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin(req);

    const parsed = promoteAdminSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Informe o telefone." }, { status: 400 });
    }
    const { telefone } = parsed.data;

    const user = await prisma.$transaction(async (tx) => {
      const before = await tx.user.findUnique({
        where: { telefone },
        select: { id: true, role: true },
      });
      if (!before) {
        throw Object.assign(new Error("UserNotFound"), { code: "USER_NOT_FOUND" });
      }

      const nextUser = await tx.user.update({
        where: { telefone },
        data: { role: "ADMIN" },
        select: { id: true, nome: true, telefone: true, email: true, role: true },
      });

      await tx.auditLog.create({
        data: {
          actorId: auth.userId,
          targetId: nextUser.id,
          targetType: "User",
          action: "ADMIN_PROMOTE",
          before: { role: before.role },
          after: { role: nextUser.role },
        },
      });

      return nextUser;
    });

    return NextResponse.json({ ok: true, user });
  } catch (e: any) {
    if (e?.code === "P2025" || e?.code === "USER_NOT_FOUND") {
      return NextResponse.json({ ok: false, error: "Usuário não encontrado pelo telefone." }, { status: 404 });
    }
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    if (e?.message === "Forbidden") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: "Erro interno" }, { status: 500 });
  }
}
