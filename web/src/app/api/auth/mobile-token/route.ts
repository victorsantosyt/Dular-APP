import { auth } from "@/lib/auth-oauth";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";

// Gera um JWT próprio (mesmo formato de /api/auth/login) a partir da session NextAuth
// e redireciona o mobile via deep link dular://auth/callback?token=JWT&role=ROLE
export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.redirect("dular://auth/callback?error=unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, nome: true, cpf: true, telefone: true },
  });

  if (!user?.role) {
    return NextResponse.redirect("dular://auth/callback?error=no_role");
  }

  if (!user.cpf || !user.telefone) {
    const onboardingUrl = new URL("/onboarding?platform=mobile", request.url);
    return NextResponse.redirect(onboardingUrl.toString());
  }

  const token = signToken({
    userId: user.id,
    role: user.role as "EMPREGADOR" | "DIARISTA" | "MONTADOR" | "ADMIN",
  });

  const deepLink = `dular://auth/callback?token=${encodeURIComponent(token)}&role=${user.role as UserRole}`;
  return NextResponse.redirect(deepLink);
}
