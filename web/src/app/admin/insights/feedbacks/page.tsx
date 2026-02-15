export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin-ui/AdminPage";
import { AdminGrid } from "@/components/admin-ui/AdminGrid";
import { AdminCard } from "@/components/admin-ui/AdminCard";
import { AdminKpi } from "@/components/admin-ui/AdminKpi";
import { AdminEmpty } from "@/components/admin-ui/AdminEmpty";

export default async function FeedbacksPage() {
  const [agg, lista] = await Promise.all([
    prisma.avaliacao.aggregate({
      _avg: { notaGeral: true },
      _count: { notaGeral: true },
    }),
    prisma.avaliacao.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true,
        notaGeral: true,
        comentario: true,
        createdAt: true,
        servico: {
          select: {
            id: true,
            bairro: true,
            cidade: true,
            cliente: { select: { nome: true } },
            diarista: { select: { nome: true } },
          },
        },
      },
    }),
  ]);

  const nota = agg._avg.notaGeral ?? 0;
  const total = agg._count.notaGeral ?? 0;

  return (
    <AdminPage title="" subtitle="">
      <AdminGrid>
        <div className="md:col-span-6">
          <AdminKpi label="Avaliação média" value={nota ? nota.toFixed(1) : "—"} hint={`${total} avaliações`} />
        </div>
        <div className="md:col-span-6">
          <AdminKpi label="Total de avaliações" value={String(total)} />
        </div>

        <div className="md:col-span-12">
          <AdminCard title="Avaliações recentes">
            {lista.length === 0 ? (
              <AdminEmpty title="Sem avaliações ainda" hint="Quando o piloto rodar, esse feed fica cheio." />
            ) : (
              <div className="space-y-3">
                {lista.map((a) => (
                  <div key={a.id} className="rounded-xl border border-slate-200 bg-white/80 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900">
                        Nota {a.notaGeral}/5{" "}
                        <span className="text-xs text-slate-500">
                          {a.servico?.bairro ?? "—"} • {a.servico?.cidade ?? "—"}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(a.createdAt).toLocaleString("pt-BR")}
                      </div>
                    </div>
                    <div className="text-xs text-slate-600">
                      Cliente: {a.servico?.cliente?.nome ?? "—"} • Diarista: {a.servico?.diarista?.nome ?? "—"}
                    </div>
                    <div className="mt-2 text-sm text-slate-800">
                      {a.comentario?.trim() ? a.comentario : <span className="text-slate-500">Sem comentário.</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AdminCard>
        </div>
      </AdminGrid>
    </AdminPage>
  );
}
