import { auth } from "@/lib/auth-oauth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

const ROLE_MAP = { cliente: "CLIENTE", diarista: "DIARISTA" } as const;
type UrlRole = keyof typeof ROLE_MAP;

export default async function AuthCallbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ role: string }>;
  searchParams: Promise<{ platform?: string }>;
}) {
  const { role } = await params;
  const { platform } = await searchParams;
  const isMobile = platform === "mobile";

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
  if (!user?.role || (isMobile && user.role !== dbRole)) {
    user = await prisma.user.update({
      where: { id: session.user.id },
      data: { role: dbRole },
      select: { role: true, cpf: true, telefone: true },
    });

    if (dbRole === "DIARISTA") {
      await prisma.diaristaProfile.upsert({
        where: { userId: session.user.id },
        update: {},
        create: { userId: session.user.id, precoLeve: 0, precoPesada: 0 },
      });
    }
  }

  // Onboarding obrigatório para web e mobile
  if (!user?.cpf || !user?.telefone) {
    redirect(isMobile ? "/onboarding?platform=mobile" : "/onboarding");
  }

  // Mobile: gera JWT e entrega via deep link
  if (isMobile) redirect("/api/auth/mobile-token");

  const finalRole = user?.role ?? dbRole;
  redirect(finalRole === "CLIENTE" ? "/cliente" : "/diarista");
}
