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

  const form = await req.formData().catch(() => null);
  const id = (form?.get("id") as string | null)?.trim();
  const motivo = (form?.get("motivo") as string | null)?.trim() || "Marcado como disputa pelo admin";

  if (!id) {
    return fail("bad_request", "ID inválido", 400);
  }

  const svc = await prisma.servico.findUnique({ where: { id }, select: { status: true, observacoes: true } });
  if (!svc) {
    return fail("not_found", "Serviço não encontrado", 404);
  }

  const novasObs = svc.observacoes
    ? `${svc.observacoes}\n[ADMIN ${new Date().toISOString()}] DISPUTA: ${motivo}`
    : `[ADMIN ${new Date().toISOString()}] DISPUTA: ${motivo}`;

  // Não muda status; apenas registra evento e observação
  await prisma.servico.update({
    where: { id },
    data: { observacoes: novasObs },
  });

  await prisma.servicoEvento.create({
    data: {
      servicoId: id,
      fromStatus: svc.status,
      toStatus: svc.status,
      actorRole: "ADMIN",
      actorId: auth.userId,
    },
  });

  return ok();
}
