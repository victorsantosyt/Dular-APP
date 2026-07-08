import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOuSessao } from "@/lib/pagamentoPix";
import { normalizarChavePix } from "@/lib/pixKey";
import { assertRole } from "@/lib/regrasServico";
import type { UserRole } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * Recebimentos do profissional (chave PIX).
 * GET  /api/me/payment-info — dados atuais (só o próprio dono vê a chave completa).
 * PUT  /api/me/payment-info — cria/edita (upsert, salvamento imediato).
 * Somente DIARISTA/MONTADOR — quem recebe é o profissional.
 */

const putSchema = z.object({
  pixType: z.enum(["CPF", "CELULAR", "EMAIL", "ALEATORIA"]),
  pixKey: z.string().trim().min(1, "Informe a chave PIX.").max(140),
  bank: z.string().trim().max(80).optional().nullable(),
  holderName: z.string().trim().min(3, "Informe o nome do titular.").max(120),
});

function toDto(info: {
  pixType: string;
  pixKey: string;
  bank: string | null;
  holderName: string;
  updatedAt: Date;
}) {
  return {
    pixType: info.pixType,
    pixKey: info.pixKey,
    bank: info.bank,
    holderName: info.holderName,
    updatedAt: info.updatedAt,
  };
}

export async function GET(req: Request) {
  try {
    const auth = await requireAuthOuSessao(req);
    assertRole(auth.role as UserRole, ["DIARISTA", "MONTADOR"]);

    const info = await prisma.paymentInfo.findUnique({
      where: { userId: auth.userId },
    });

    return NextResponse.json({ ok: true, paymentInfo: info ? toDto(info) : null });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro";
    if (msg === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    if (msg === "FORBIDDEN") {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await requireAuthOuSessao(req);
    assertRole(auth.role as UserRole, ["DIARISTA", "MONTADOR"]);

    const body = await req.json().catch(() => null);
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const normalizada = normalizarChavePix(parsed.data.pixType, parsed.data.pixKey);
    if (!normalizada.ok) {
      return NextResponse.json({ ok: false, error: normalizada.error }, { status: 400 });
    }

    const data = {
      pixType: parsed.data.pixType,
      pixKey: normalizada.key,
      bank: parsed.data.bank?.trim() || null,
      holderName: parsed.data.holderName.trim(),
    };

    const info = await prisma.paymentInfo.upsert({
      where: { userId: auth.userId },
      update: data,
      create: { userId: auth.userId, ...data },
    });

    return NextResponse.json({ ok: true, paymentInfo: toDto(info) });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro";
    if (msg === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    if (msg === "FORBIDDEN") {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
