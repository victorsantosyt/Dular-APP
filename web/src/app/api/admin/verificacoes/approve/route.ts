import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { rateLimit, cleanupRateLimit } from "@/lib/rateLimit";
import { getRequestIp } from "@/lib/requestIp";
import { fail, ok } from "@/lib/apiResponse";
import { aplicarEvento } from "@/lib/safeScore";

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

  // T-18.6: aprovação real precisa sincronizar TODOS os campos por role.
  // - DIARISTA  → DiaristaProfile.verificacao = VERIFICADO
  // - MONTADOR  → MontadorPerfil.verificado   = true
  // - EMPREGADOR→ só DocumentVerification (sem campo no perfil; é o que
  //               getEmpregadorVerificationStatus já consome)
  // Em todos os casos a tabela DocumentVerification recebe um registro
  // APPROVED como log de auditoria e KYC_APROVADO é disparado no
  // SafeScore (que recalcula tier e propaga em SafeScoreProfile).
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });
  if (!target) {
    return fail("not_found", "Usuário não encontrado.", 404);
  }

  if (target.role === "DIARISTA") {
    await prisma.diaristaProfile.update({
      where: { userId: id },
      data: { verificacao: "VERIFICADO" },
    });
  } else if (target.role === "MONTADOR") {
    await prisma.montadorPerfil.update({
      where: { userId: id },
      data: { verificado: true },
    });
  }

  await prisma.documentVerification.create({
    data: {
      userId: id,
      docType: `${target.role ?? "KYC"}_REVIEW`,
      docUrl: "",
      status: "APPROVED",
      reviewedBy: auth.userId,
      reviewNote: `KYC APROVADO por admin ${auth.userId} em ${new Date().toISOString()} — ${motivo}`,
    },
  });

  await aplicarEvento(id, "KYC_APROVADO", id, motivo);

  return ok();
}
