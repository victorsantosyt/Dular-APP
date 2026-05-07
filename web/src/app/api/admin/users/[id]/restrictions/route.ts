import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { UserRestrictionType } from "@prisma/client";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const VALID_TYPES: UserRestrictionType[] = [
  "SHADOW_BAN",
  "LIMIT_BOOKINGS",
  "SUSPEND",
  "BLOCK",
];

export async function POST(req: Request, { params }: Params) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) {
      return NextResponse.json({ ok: false, error: "Usuário não encontrado" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const type: UserRestrictionType = body?.type;
    const reason: string = body?.reason?.trim();
    const expiresAt: string | undefined = body?.expiresAt;

    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { ok: false, error: `Tipo inválido. Use: ${VALID_TYPES.join(", ")}` },
        { status: 400 }
      );
    }
    if (!reason) {
      return NextResponse.json({ ok: false, error: "Motivo obrigatório." }, { status: 400 });
    }

    const restriction = await prisma.$transaction(async (tx) => {
      const r = await tx.userRestriction.create({
        data: {
          userId: id,
          type,
          reason,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          createdBy: auth.userId,
        },
      });

      // Sincronizar emObservacao no User para qualquer restrição ativa
      await tx.user.update({
        where: { id },
        data: { emObservacao: true },
      });

      return r;
    });

    return NextResponse.json({ ok: true, restriction });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}
