import { auth } from "@/lib/auth-oauth";
import { redirect } from "next/navigation";

export default async function MontadorPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  if (session.user.role !== "MONTADOR") redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F8F6] px-6">
      <section className="w-full max-w-md text-center">
        <h1 className="text-xl font-bold text-dular-ink">Perfil Montador</h1>
        <p className="mt-3 text-sm leading-6 text-dular-sub">
          Seu perfil foi criado com segurança. A area operacional de montadores ainda esta em preparacao.
        </p>
      </section>
    </main>
  );
}
