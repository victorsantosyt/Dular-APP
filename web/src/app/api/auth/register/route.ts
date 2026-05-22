import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { registerSchema } from "@/lib/schemas/auth";
import { ensureUserRoleProfile } from "@/lib/userProfiles";
import { cleanupRateLimit, rateLimit, rateLimitRetryAfterMs } from "@/lib/rateLimit";
import { getRequestIp } from "@/lib/requestIp";

export async function POST(req: Request) {
  try {
    cleanupRateLimit();

    const ip = getRequestIp(req);
    const rlIp = rateLimit({ key: `register-ip:${ip}`, limit: 10, windowMs: 10 * 60_000 });
    if (!rlIp.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "RATE_LIMITED",
          message: "Muitas tentativas. Aguarde um pouco e tente novamente.",
          retryAfterMs: rateLimitRetryAfterMs(rlIp.resetAt),
        },
        { status: 429 },
      );
    }

    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const { nome, telefone, senha, role } = parsed.data;
    const rlTelefone = rateLimit({
      key: `register-phone:${telefone}`,
      limit: 3,
      windowMs: 60 * 60_000,
    });
    if (!rlTelefone.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "RATE_LIMITED",
          message: "Muitas tentativas. Aguarde um pouco e tente novamente.",
          retryAfterMs: rateLimitRetryAfterMs(rlTelefone.resetAt),
        },
        { status: 429 },
      );
    }

    const exists = await prisma.user.findUnique({ where: { telefone } });
    if (exists) {
      return NextResponse.json({ error: "Telefone já cadastrado" }, { status: 409 });
    }

    const senhaHash = await hashPassword(senha);

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          nome,
          telefone,
          senhaHash,
          role,
        },
      });

      await ensureUserRoleProfile(tx, user.id, role);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
