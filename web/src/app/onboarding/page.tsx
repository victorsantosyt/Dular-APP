import { auth } from "@/lib/auth-oauth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ platform?: string }>;
}) {
  const { platform } = await searchParams;
  const isMobile = platform === "mobile";

  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { nome: true, telefone: true, cpf: true, role: true },
  });

  // Perfil já completo — mobile volta para gerar o token, web vai para a home
  if (user?.telefone && user?.cpf) {
    if (isMobile) redirect("/api/auth/mobile-token");
    if (user.role === "EMPREGADOR") redirect("/cliente");
    if (user.role === "DIARISTA") redirect("/diarista");
    if (user.role === "MONTADOR") redirect("/montador");
  }

  return (
    <OnboardingForm
      role={session.user.role ?? null}
      nome={user?.nome ?? session.user.name}
      platform={platform}
    />
  );
}
