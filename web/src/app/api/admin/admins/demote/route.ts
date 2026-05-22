import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAuth";
import { ensureUserRoleProfile } from "@/lib/userProfiles";
import { z } from "zod";

export const dynamic = "force-dynamic";

const demoteAdminSchema = z.object({
  userId: z.string().trim().min(8),
});

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin(req);

    const parsed = demoteAdminSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Informe o userId." }, { status: 400 });
    }
    const { userId } = parsed.data;

    if (userId === auth.userId) {
      return NextResponse.json({ ok: false, error: "Você não pode remover a si mesmo." }, { status: 400 });
    }

    const user = await prisma.$transaction(async (tx) => {
      const before = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
      });
      if (!before) {
        throw Object.assign(new Error("UserNotFound"), { code: "USER_NOT_FOUND" });
      }
      if (before.role !== "ADMIN") {
        throw Object.assign(new Error("NotAdmin"), { code: "NOT_ADMIN" });
      }

      const adminCount = await tx.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        throw Object.assign(new Error("LastAdmin"), { code: "LAST_ADMIN" });
      }

      const nextUser = await tx.user.update({
        where: { id: userId },
        data: { role: "EMPREGADOR" },
        select: { id: true, nome: true, telefone: true, email: true, role: true },
      });

      await ensureUserRoleProfile(tx, nextUser.id, nextUser.role);
      await tx.auditLog.create({
        data: {
          actorId: auth.userId,
          targetId: nextUser.id,
          targetType: "User",
          action: "ADMIN_DEMOTE",
          before: { role: before.role },
          after: { role: nextUser.role },
        },
      });
      return nextUser;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ ok: true, user });
  } catch (e: any) {
    if (e?.code === "P2025" || e?.code === "USER_NOT_FOUND") {
      return NextResponse.json({ ok: false, error: "Usuário não encontrado." }, { status: 404 });
    }
    if (e?.code === "NOT_ADMIN") {
      return NextResponse.json({ ok: false, error: "Usuário informado não é administrador." }, { status: 400 });
    }
    if (e?.code === "LAST_ADMIN") {
      return NextResponse.json(
        {
          ok: false,
          error: "LAST_ADMIN",
          message: "Não é possível rebaixar o último administrador ativo.",
        },
        { status: 409 },
      );
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
