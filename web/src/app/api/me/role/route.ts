import { auth } from "@/lib/auth-oauth";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/apiResponse";
import { z } from "zod";

const schema = z.object({ role: z.enum(["CLIENTE", "DIARISTA"]) });

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return fail("unauthorized", "Não autorizado", 401);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("bad_request", "Role inválido", 400);

  const { role } = parsed.data;

  await prisma.user.update({
    where: { id: session.user.id },
    data: { role },
  });

  if (role === "DIARISTA") {
    await prisma.diaristaProfile.upsert({
      where: { userId: session.user.id },
      update: {},
      create: { userId: session.user.id, precoLeve: 0, precoPesada: 0 },
    });
  }

  return ok({ ok: true, role });
}
