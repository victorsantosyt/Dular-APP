import { prisma } from "@/lib/prisma";
import { IncidentCard } from "./_components/IncidentCard";

export const dynamic = "force-dynamic";

const STATUS = ["ABERTO", "EM_ANALISE", "CONFIRMADO", "ENCERRADO"];

export default async function AdminIncidentesPage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  const status = (searchParams?.status || "ABERTO").toUpperCase();

  const incidents = await prisma.incidentReport.findMany({
    where: status ? { status: status as any } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      reportedUser: { select: { nome: true, telefone: true } },
      reportedBy: { select: { nome: true, telefone: true } },
    },
    take: 50,
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-extrabold text-gray-900">Incidentes</h1>
        <p className="text-sm text-gray-600">
          Abra um item para ver evidências (links assinados) e alterar status.
        </p>

        <div className="flex flex-wrap gap-2 pt-2">
          {STATUS.map((s) => (
            <a
              key={s}
              href={`/admin/incidentes?status=${s}`}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                s === status
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-700 border-gray-200"
              }`}
            >
              {s}
            </a>
          ))}
        </div>
      </header>

      <section className="mt-4 grid gap-3">
        {incidents.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-gray-600">
            Nenhum incidente para este filtro.
          </div>
        ) : (
          incidents.map((item) => <IncidentCard key={item.id} item={item as any} />)
        )}
      </section>
    </main>
  );
}
