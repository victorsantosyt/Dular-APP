import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { signToken } from "@/lib/auth";
import { loginSchema } from "@/lib/schemas/auth";
import { rateLimit, cleanupRateLimit } from "@/lib/rateLimit";
import { getRequestIp } from "@/lib/requestIp";
import { fail, ok } from "@/lib/apiResponse";

export async function POST(req: Request) {
  try {
    cleanupRateLimit();

    const ip = getRequestIp(req);
    const body = await req.json().catch(() => null);

    // compat: aceita { login, senha } ou { telefone, senha }
    const loginFromBody =
      typeof body?.login === "string"
        ? body.login
        : typeof body?.telefone === "string"
          ? body.telefone
          : "";
    const userAgent = req.headers.get("user-agent") ?? "unknown";
    console.log(
      `[AUTH LOGIN] ${new Date().toISOString()} ip=${ip} ua="${userAgent}" login="${loginFromBody}"`
    );

    const parsed = loginSchema.safeParse({
      login: loginFromBody,
      senha: body?.senha,
    });

    if (!parsed.success) {
      return fail("bad_request", "Dados inválidos", 400);
    }

    const { login, senha } = parsed.data;
    const loginRaw = (login || "").trim();
    const senhaRaw = (senha || "").trim();

    if (!loginRaw) return fail("bad_request", "Informe telefone ou email.", 400);
    if (!senhaRaw) return fail("bad_request", "Informe a senha.", 400);

    const identifier = loginRaw.toLowerCase() || "unknown";

    // Rate limit duplo: IP (mais tolerante) + usuário (mais restritivo)
    const rlIp = rateLimit({ key: `login-ip:${ip}`, limit: 20, windowMs: 60_000 });
    const rlUser = rateLimit({ key: `login-user:${identifier}`, limit: 8, windowMs: 60_000 });

    if (!rlIp.ok || !rlUser.ok) {
      const retryAfterMs = Math.max(0, Math.min(rlIp.resetAt, rlUser.resetAt) - Date.now());
      return fail(
        "rate_limited",
        "Muitas tentativas. Aguarde um pouco e tente novamente.",
        429,
        { retryAfterMs }
      );
    }

    const loginLower = loginRaw.toLowerCase();

    // Seleção defensiva: usa apenas campos que existem no schema atual (senhaHash)
    const user = (await prisma.user.findFirst({
      where: {
        OR: [{ telefone: loginRaw }, { email: loginLower }],
      },
      select: {
        id: true,
        role: true,
        nome: true,
        telefone: true,
        email: true,
        status: true,
        senhaHash: true,
      },
    })) as any;
    if (!user) {
      return fail("invalid_credentials", "Credenciais inválidas", 401);
    }

    // Hash único padronizado no schema atual
    const hash = user?.senhaHash;
    if (!hash) {
      return fail("invalid_credentials", "Credenciais inválidas", 401);
    }

    const valid = await verifyPassword(senhaRaw, hash);
    if (!valid) {
      return fail("invalid_credentials", "Credenciais inválidas", 401);
    }

    if (user.status !== "ATIVO") {
      return fail("blocked_user", "Usuário bloqueado", 403);
    }

    const token = signToken({ userId: user.id, role: user.role });

    const res = ok({
      ok: true,
      token,
      user: {
        id: user.id,
        nome: user.nome,
        role: user.role,
        telefone: user.telefone ?? loginLower,
      },
    });

    res.cookies.set("dular_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 dias
    });

    return res;
  } catch (error) {
    console.error(error);
    return fail("internal_error", "Erro interno", 500);
  }
}
