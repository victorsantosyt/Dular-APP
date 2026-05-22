import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAuth";
import bcrypt from "bcryptjs";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createAdminSchema = z.object({
  telefone: z.string().trim().min(10).max(20),
  senha: z
    .string()
    .min(10)
    .regex(/[a-z]/)
    .regex(/[A-Z]/)
    .regex(/\d/),
});

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin(req);

    const parsed = createAdminSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Dados inválidos. Senha deve ter 10+ caracteres, letra maiúscula, minúscula e número.",
        },
        { status: 400 },
      );
    }

    const { telefone, senha } = parsed.data;

    const senhaHash = await bcrypt.hash(senha, 10);

    const user = await prisma.$transaction(async (tx) => {
      const before = await tx.user.findUnique({
        where: { telefone },
        select: { id: true, role: true },
      });

      const nextUser = await tx.user.upsert({
        where: { telefone },
        update: { role: "ADMIN", senhaHash },
        create: { telefone, role: "ADMIN", senhaHash, nome: telefone },
        select: { id: true, telefone: true, role: true },
      });

      await tx.auditLog.create({
        data: {
          actorId: auth.userId,
          targetId: nextUser.id,
          targetType: "User",
          action: before ? "ADMIN_PROMOTE_WITH_PASSWORD_RESET" : "ADMIN_CREATE",
          before: before ? { role: before.role } : undefined,
          after: { role: nextUser.role },
        },
      });

      return nextUser;
    });

    return NextResponse.json({ ok: true, user });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    if (e?.message === "Forbidden") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: "Erro interno" }, { status: 500 });
  }
}
