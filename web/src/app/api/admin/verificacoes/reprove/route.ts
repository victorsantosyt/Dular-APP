import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { rateLimit, cleanupRateLimit } from "@/lib/rateLimit";
import { getRequestIp } from "@/lib/requestIp";
import { aplicarEvento } from "@/lib/safeScore";
import { ensureUserRoleProfile } from "@/lib/userProfiles";
import { getGuardianStatusForUser } from "@/lib/safeScoreGuardian";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readPayload(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    return {
      id: typeof body.verificationId === "string" ? body.verificationId : typeof body.id === "string" ? body.id : "",
      motivo: typeof body.motivo === "string" ? body.motivo : "",
    };
  }

  const data = await req.formData().catch(() => null);
  return {
    id: (data?.get("verificationId") as string | null) ?? (data?.get("id") as string | null) ?? "",
    motivo: (data?.get("motivo") as string | null) ?? "",
  };
}

function adminGate(req: Request) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "ADMIN") {
      return { error: NextResponse.json({ ok: false, error: "Acesso negado." }, { status: 403 }) };
    }
    return { auth };
  } catch {
    return { error: NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 }) };
  }
}

export async function POST(req: Request) {
  cleanupRateLimit();
  const ip = getRequestIp(req);
  const rl = rateLimit({ key: `admin:${ip}`, limit: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Muitas ações em pouco tempo. Aguarde e tente novamente.", retryAfterMs: Math.max(0, rl.resetAt - Date.now()) },
      { status: 429 },
    );
  }

  const gate = adminGate(req);
  if (gate.error) return gate.error;

  const payload = await readPayload(req);
  const id = payload.id.trim();
  const motivo = payload.motivo.trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "ID inválido." }, { status: 400 });
  }
  if (!motivo) {
    return NextResponse.json({ ok: false, error: "Informe o motivo da reprovação." }, { status: 400 });
  }

  const existing = await prisma.documentVerification.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      docType: true,
      status: true,
      user: { select: { id: true, role: true } },
    },
  });

  if (!existing) {
    return NextResponse.json({ ok: false, error: "Verificação não encontrada." }, { status: 404 });
  }

  if (existing.user.role !== "EMPREGADOR" && existing.user.role !== "DIARISTA" && existing.user.role !== "MONTADOR") {
    return NextResponse.json({ ok: false, error: "Perfil não suportado para verificação documental." }, { status: 400 });
  }

  const verification = await prisma.$transaction(async (tx) => {
    await ensureUserRoleProfile(tx, existing.userId, existing.user.role);

    if (existing.user.role === "DIARISTA") {
      await tx.diaristaProfile.update({
        where: { userId: existing.userId },
        data: { verificacao: "REPROVADO" },
      });
    }

    if (existing.user.role === "MONTADOR") {
      await tx.montadorPerfil.update({
        where: { userId: existing.userId },
        data: { verificado: false },
      });
    }

    return tx.documentVerification.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedBy: gate.auth.userId,
        reviewNote: `KYC REPROVADO por admin ${gate.auth.userId} em ${new Date().toISOString()} - ${motivo}`,
      },
      select: {
        id: true,
        userId: true,
        docType: true,
        status: true,
        reviewedBy: true,
        reviewNote: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  await aplicarEvento(existing.userId, "KYC_REJEITADO" as any, id, motivo).catch(() => null);
  const guardian = await getGuardianStatusForUser(existing.userId);

  return NextResponse.json({ ok: true, verification, guardian });
}
