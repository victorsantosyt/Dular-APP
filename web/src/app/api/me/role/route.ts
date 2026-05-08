import { auth } from "@/lib/auth-oauth";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/apiResponse";
import { z } from "zod";
import { ensureUserRoleProfile } from "@/lib/userProfiles";

const schema = z.object({ role: z.enum(["EMPREGADOR", "DIARISTA", "MONTADOR"]) });

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return fail("unauthorized", "Não autorizado", 401);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("bad_request", "Role inválido", 400);

  const { role } = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: session.user.id },
      data: { role },
    });

    await ensureUserRoleProfile(tx, session.user.id, role);
  });

  return ok({ ok: true, role });
}
