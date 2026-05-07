import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; restrictionId: string }> };

export async function DELETE(req: Request, { params }: Params) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { id, restrictionId } = await params;

    const restriction = await prisma.userRestriction.findUnique({
      where: { id: restrictionId },
      select: { id: true, userId: true, revokedAt: true },
    });

    if (!restriction) {
      return NextResponse.json({ ok: false, error: "Restrição não encontrada" }, { status: 404 });
    }
    if (restriction.userId !== id) {
      return NextResponse.json({ ok: false, error: "Restrição não pertence a este usuário" }, { status: 400 });
    }
    if (restriction.revokedAt) {
      return NextResponse.json({ ok: false, error: "Restrição já foi revogada" }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.userRestriction.update({
        where: { id: restrictionId },
        data: { revokedAt: new Date() },
      });

      // Rever emObservacao: só limpar se não houver outras restrições ativas
      const activeCount = await tx.userRestriction.count({
        where: {
          userId: id,
          revokedAt: null,
          id: { not: restrictionId },
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
      });

      if (activeCount === 0) {
        await tx.user.update({
          where: { id },
          data: { emObservacao: false },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}
