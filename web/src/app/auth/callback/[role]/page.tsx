import { auth } from "@/lib/auth-oauth";
import { prisma } from "@/lib/prisma";
import { ensureUserRoleProfile } from "@/lib/userProfiles";
import { redirect } from "next/navigation";

const ROLE_MAP = { cliente: "EMPREGADOR", diarista: "DIARISTA", montador: "MONTADOR" } as const;
type UrlRole = keyof typeof ROLE_MAP;

function roleHomePath(role: string | null | undefined) {
  if (role === "EMPREGADOR") return "/cliente";
  if (role === "DIARISTA") return "/diarista";
  if (role === "MONTADOR") return "/montador";
  return "/";
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
    select: { role: true, cpf: true, telefone: true },
  });

  // Aplica o role escolhido: sempre para usuários novos (sem role),
  // e para mobile quando o role no banco difere do escolhido.
  const finalRole = !user?.role || (isMobile && user.role !== dbRole) ? dbRole : user.role;

  user = await prisma.$transaction(async (tx) => {
    const needsUpdate = finalRole !== user?.role || (generoValue !== undefined && isMobile);
    const nextUser = needsUpdate
      ? await tx.user.update({
          where: { id: session.user.id },
          data: {
            role: finalRole,
            ...(generoValue && isMobile ? { genero: generoValue } : {}),
          },
          select: { role: true, cpf: true, telefone: true },
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
