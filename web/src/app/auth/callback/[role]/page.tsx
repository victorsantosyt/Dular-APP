import { auth } from "@/lib/auth-oauth";
import { prisma } from "@/lib/prisma";
import { ensureUserRoleProfile, roleMismatchMessage } from "@/lib/userProfiles";
import type { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const ROLE_MAP = { cliente: "EMPREGADOR", empregador: "EMPREGADOR", diarista: "DIARISTA", montador: "MONTADOR" } as const;
type UrlRole = keyof typeof ROLE_MAP;

function roleHomePath(role: string | null | undefined) {
  if (role === "EMPREGADOR") return "/cliente";
  if (role === "DIARISTA") return "/diarista";
  if (role === "MONTADOR") return "/montador";
  return "/";
}

function redirectRoleMismatch(role: string, isMobile: boolean, existingRole: UserRole, requestedRole: UserRole) {
  const message = roleMismatchMessage(existingRole, requestedRole);
  const params = new URLSearchParams({
    error: "ROLE_MISMATCH",
    message,
    roleExistente: existingRole,
    roleSolicitado: requestedRole,
    existingRole,
    requestedRole,
  });

  if (isMobile) {
    redirect(`dular://auth/callback?${params.toString()}`);
  }

  redirect(`/login/${role}?${params.toString()}`);
}

export default async function AuthCallbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ role: string }>;
  searchParams: Promise<{ platform?: string; genero?: string }>;
}) {
  const { role } = await params;
  const { platform, genero } = await searchParams;
  const isMobile = platform === "mobile";
  const generoValue = genero === "MASCULINO" || genero === "FEMININO" ? genero : undefined;

  const dbRole = ROLE_MAP[role as UrlRole];
  if (!dbRole) redirect("/");

  const session = await auth();
  if (!session?.user?.id) {
    const loginUrl = isMobile ? `/login/${role}?platform=mobile` : `/login/${role}`;
    redirect(loginUrl);
  }

  let user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, cpf: true, telefone: true, genero: true },
  });

  if (user?.role && user.role !== dbRole) {
    redirectRoleMismatch(role, isMobile, user.role, dbRole);
  }

  const finalRole = user?.role ?? dbRole;

  user = await prisma.$transaction(async (tx) => {
    const isAssigningRole = !user?.role;
    // FASE 1 — gênero como atributo de conta: grava o gênero recebido do mobile
    // sempre que a conta AINDA não tiver gênero, mesmo que a role já exista
    // (contas antigas / primeiro login feito sem gênero). O backend é a fonte de
    // verdade e um gênero já definido nunca é sobrescrito aqui.
    const shouldBackfillGenero = !!generoValue && isMobile && !user?.genero;
    const needsUpdate = isAssigningRole || shouldBackfillGenero;
    const nextUser = needsUpdate
      ? await tx.user.update({
          where: { id: session.user.id },
          data: {
            ...(isAssigningRole ? { role: finalRole } : {}),
            ...(shouldBackfillGenero ? { genero: generoValue } : {}),
          },
          select: { role: true, cpf: true, telefone: true, genero: true },
        })
      : user;

    await ensureUserRoleProfile(tx, session.user.id, finalRole);
    return nextUser;
  });

  // Onboarding obrigatório para web e mobile
  if (!user?.cpf || !user?.telefone) {
    redirect(isMobile ? "/onboarding?platform=mobile" : "/onboarding");
  }

  // Mobile: gera JWT e entrega via deep link
  if (isMobile) redirect("/api/auth/mobile-token");

  redirect(roleHomePath(user?.role ?? finalRole));
}
