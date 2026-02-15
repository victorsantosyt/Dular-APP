export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin-ui/AdminPage";
import { AdminGrid } from "@/components/admin-ui/AdminGrid";
import { AdminCard } from "@/components/admin-ui/AdminCard";
import { AdminKpi } from "@/components/admin-ui/AdminKpi";
import { AdminEmpty } from "@/components/admin-ui/AdminEmpty";
import { AdminTable } from "@/components/admin-ui/AdminTable";
import DownloadsArea from "@/app/admin/_ui/DownloadsArea";

export default async function InsightsPage() {
  const [servicosTotal, andamento, cancelados, finalizados, avaliacaoAgg, topBairrosRaw, topDiaristasRaw, ultimasAval] =
    await Promise.all([
      prisma.servico.count(),
      prisma.servico.count({ where: { status: { in: ["SOLICITADO", "ACEITO", "EM_ANDAMENTO"] } } }),
      prisma.servico.count({ where: { status: "CANCELADO" } }),
      prisma.servico.count({ where: { status: "FINALIZADO" } }),
      prisma.avaliacao.aggregate({ _avg: { notaGeral: true }, _count: { notaGeral: true } }),
      prisma.servico.groupBy({
        by: ["bairro", "cidade"],
        _count: { _all: true },
      }),
      prisma.avaliacao.groupBy({
        by: ["diaristaId"],
        _avg: { notaGeral: true },
        _count: { _all: true },
        orderBy: { _avg: { notaGeral: "desc" } },
        take: 5,
      }),
      prisma.avaliacao.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          notaGeral: true,
          comentario: true,
          createdAt: true,
          servico: {
            select: {
              bairro: true,
              cidade: true,
              cliente: { select: { nome: true } },
              diarista: { select: { nome: true } },
            },
          },
        },
      }),
    ]);

  const diaristaIds = topDiaristasRaw.map((d) => d.diaristaId);
  const diaristas =
    diaristaIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: diaristaIds } },
          select: { id: true, nome: true },
        })
      : [];
  const diaristaById = new Map(diaristas.map((d) => [d.id, d]));

  const topBairros = topBairrosRaw.map((b) => ({
    bairro: b.bairro || "—",
    cidade: b.cidade || "—",
    total: b._count._all,
  }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const topDiaristas = topDiaristasRaw.map((d) => ({
    diaristaId: d.diaristaId,
    nome: diaristaById.get(d.diaristaId)?.nome ?? "Diarista",
    nota: d._avg.notaGeral ?? 0,
    total: d._count._all,
  }));

  const mediaNota = avaliacaoAgg._avg.notaGeral ?? 0;
  const totalAval = avaliacaoAgg._count.notaGeral ?? 0;

  return (
    <AdminPage title="" subtitle="">
      <AdminGrid>
        <div className="md:col-span-3">
          <AdminKpi label="Serviços totais" value={String(servicosTotal)} />
        </div>
        <div className="md:col-span-3">
          <AdminKpi label="Em aberto/andamento" value={String(andamento)} hint="SOLICITADO/ACEITO/EM_ANDAMENTO" />
        </div>
        <div className="md:col-span-3">
          <AdminKpi label="Cancelados" value={String(cancelados)} />
        </div>
        <div className="md:col-span-3">
          <AdminKpi label="Finalizados" value={String(finalizados)} />
        </div>

        <div className="md:col-span-6">
          <AdminKpi
            label="Avaliação média"
            value={mediaNota ? mediaNota.toFixed(1) : "—"}
            hint={`${totalAval} avaliações`}
          />
        </div>
        <div className="md:col-span-6">
          <AdminKpi label="Tendência (mock)" value="+6,2%" hint="Últimos 30 dias" />
        </div>

        <div className="md:col-span-8">
          <AdminCard
            title="Tendência semanal"
            right={
              <div className="flex gap-2 text-xs text-slate-600">
                <span className="rounded-full bg-emerald-200/60 px-3 py-1 font-semibold text-emerald-900">7 dias</span>
                <span className="rounded-full bg-white/60 px-3 py-1">30 dias</span>
              </div>
            }
          >
            <div className="rounded-2xl border border-white/50 bg-white/50 p-2">
              <DownloadsArea />
            </div>
          </AdminCard>
        </div>

        <div className="md:col-span-4">
          <AdminCard title="Top bairros">
            {topBairros.length === 0 ? (
              <AdminEmpty title="Sem dados" hint="Quando houver serviços, os bairros aparecem aqui." />
            ) : (
              <AdminTable
                columns={[
                  { key: "bairro", label: "Bairro" },
                  { key: "cidade", label: "Cidade" },
                  { key: "total", label: "Serviços" },
                ]}
                rows={topBairros}
              />
            )}
          </AdminCard>
        </div>

        <div className="md:col-span-6">
          <AdminCard title="Top diaristas (nota)">
            {topDiaristas.length === 0 ? (
              <AdminEmpty title="Sem avaliações ainda" />
            ) : (
              <AdminTable
                columns={[
                  { key: "nome", label: "Diarista" },
                  { key: "nota", label: "Nota", render: (r) => r.nota.toFixed(1) },
                  { key: "total", label: "Avaliações" },
                ]}
                rows={topDiaristas}
              />
            )}
          </AdminCard>
        </div>

        <div className="md:col-span-6">
          <AdminCard title="Últimas avaliações">
            {ultimasAval.length === 0 ? (
              <AdminEmpty title="Sem avaliações" />
            ) : (
              <div className="space-y-3">
                {ultimasAval.map((a) => (
                  <div key={a.id} className="rounded-xl border border-slate-200 bg-white/80 p-3">
                    <div className="flex items-start justify-between gap-3 text-sm">
                      <div className="font-semibold text-slate-900">
                        Nota {a.notaGeral}/5{" "}
                        <span className="text-xs text-slate-500">
                          {a.servico?.bairro ?? "—"} • {a.servico?.cidade ?? "—"}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(a.createdAt).toLocaleDateString("pt-BR")}
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
