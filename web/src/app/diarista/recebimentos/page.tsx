import { auth } from "@/lib/auth-oauth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RecebimentosForm } from "@/components/recebimentos/RecebimentosForm";

export const dynamic = "force-dynamic";

export default async function DiaristaRecebimentosPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  if (session.user.role !== "DIARISTA") redirect("/");

  return (
    <main className="min-h-screen bg-dular-bg px-4 pb-16">
      <div className="mx-auto w-full max-w-[420px] pt-6">
        <div className="mb-5 flex items-center gap-3">
          <Link
            href="/diarista"
            aria-label="Voltar"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-dular-stroke bg-white text-dular-ink shadow-card"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-[19px] font-black text-dular-ink">Recebimentos</h1>
            <p className="text-[12px] font-medium text-dular-sub">Receber pelo PIX</p>
          </div>
        </div>
        <section className="rounded-22 border border-dular-stroke bg-white p-5 shadow-card">
          <RecebimentosForm />
        </section>
      </div>
    </main>
  );
}
