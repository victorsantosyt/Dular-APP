import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { rateLimit, cleanupRateLimit } from "@/lib/rateLimit";
import { getRequestIp } from "@/lib/requestIp";
import { fail, ok } from "@/lib/apiResponse";

export async function POST(req: Request) {
  cleanupRateLimit();
  const ip = getRequestIp(req);
  const rl = rateLimit({ key: `admin:${ip}`, limit: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return fail(
      "rate_limited",
      "Muitas ações em pouco tempo. Aguarde e tente novamente.",
      429,
      { retryAfterMs: Math.max(0, rl.resetAt - Date.now()) }
    );
  }

  const auth = requireAuth(req);
  if (auth.role !== "ADMIN") {
    return fail("forbidden", "Acesso negado.", 403);
  }

  const data = await req.formData().catch(() => null);
  const id = (data?.get("id") as string | null)?.trim();
  const motivo = (data?.get("motivo") as string | null)?.trim();
  if (!id) {
    return fail("bad_request", "ID inválido", 400);
  }
  if (!motivo) {
    return fail("bad_request", "Informe um motivo.", 400);
  }

  const logEntry = `[ADMIN ${new Date().toISOString()}] REPROVADO: ${motivo}`;

  await prisma.diaristaProfile.update({
    where: { userId: id },
    data: {
      verificacao: "REPROVADO",
    },
  });

  await prisma.$executeRawUnsafe(
    `UPDATE "DiaristaProfile" SET bio = CASE WHEN bio IS NULL THEN $1 ELSE bio || E'\n' || $1 END WHERE "userId" = $2`,
    logEntry,
    id
  );

  return ok();
}
