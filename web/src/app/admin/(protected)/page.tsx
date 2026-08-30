export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { prisma } from "@/lib/prisma";
import { computeBetaMetrics } from "@/lib/adminMetrics";
import { AdminPage } from "@/components/admin-ui/AdminPage";
import { AdminGrid } from "@/components/admin-ui/AdminGrid";
import { AdminCard } from "@/components/admin-ui/AdminCard";
import { AdminKpi } from "@/components/admin-ui/AdminKpi";
import { AdminEmpty } from "@/components/admin-ui/AdminEmpty";
import ConcluidosSemanaChart from "@/app/admin/insights/ConcluidosSemanaChart";

function pct(v: number | null): string {
  return v === null ? "—" : `${v.toFixed(0)}%`;
}

export default async function AdminHomePage() {
  const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    servicos,
    eventos,
    profissionais,
    usuariosTotal,
    usuariosNovos30d,
    avaliacaoAgg,
    incidentesAbertos,
    avaliacoesNegativas,
  ] = await Promise.all([
    prisma.servico.findMany({
      select: {
        id: true,
        createdAt: true,
        status: true,
        diaristaId: true,
        montadorId: true,
        paymentStatus: true,
        bairro: true,
        cidade: true,
      },
    }),
    prisma.servicoEvento.findMany({
      where: { toStatus: { in: ["ACEITO", "CONCLUIDO", "CONFIRMADO", "FINALIZADO"] } },
      select: { servicoId: true, toStatus: true, createdAt: true },
    }),
    prisma.user.findMany({
      where: { role: { in: ["DIARISTA", "MONTADOR"] } },
      select: { id: true, createdAt: true },
    }),
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: trintaDiasAtras } } }),
    prisma.avaliacao.aggregate({ _avg: { notaGeral: true }, _count: { notaGeral: true } }),
    prisma.incidentReport.count({ where: { status: { in: ["ABERTO", "EM_ANALISE"] } } }),
    prisma.avaliacao.count({ where: { notaGeral: { lte: 2 } } }),
  ]);

  const m = computeBetaMetrics({ servicos, eventos, profissionais, agora: new Date() });
  const mediaNota = avaliacaoAgg._avg.notaGeral;
  const totalAval = avaliacaoAgg._count.notaGeral;

  return (
    <AdminPage title="" subtitle="">
      <AdminGrid>
        {/* KPIs (pequenos) */}
        <div className="md:col-span-3">
          <AdminKpi label="Usuários cadastrados" value={String(usuariosTotal)} />
        </div>
        <div className="md:col-span-3">
          <AdminKpi
            label="Novos usuários (30 dias)"
            value={`+${usuariosNovos30d}`}
          />
        </div>
        <div className="md:col-span-3">
          <AdminKpi
            label="Avaliação média"
            value={mediaNota ? mediaNota.toFixed(1) : "—"}
            hint={`${totalAval} avaliações`}
          />
        </div>
        <div className="md:col-span-3">
          <AdminKpi
            label="Retenção de profissionais"
            value={pct(m.retencao.pct)}
            hint={`${m.retencao.retidos}/${m.retencao.ativosSemanaBase} nas 2 últimas semanas · meta ≥30%`}
          />
        </div>

        {/* Card grande - ocupa a linha inteira */}
        <div className="md:col-span-12">
          <AdminCard
            title="Serviços concluídos por semana"
            right={
              <span className="rounded-full bg-accent-subtle px-3 py-1 text-xs font-semibold text-accent-active">
                North Star · 8 semanas
              </span>
            }
          >
            <div className="rounded-2xl border border-glass-border bg-glass-surface p-2">
              {m.totalConcluidos === 0 ? (
                <AdminEmpty
                  title="Nenhum serviço concluído ainda"
                  hint="O gráfico aparece quando o primeiro serviço for concluído."
                />
              ) : (
                <ConcluidosSemanaChart
                  data={m.semanas.map((s) => ({ rotulo: s.rotulo, concluidos: s.concluidos }))}
                />
              )}
            </div>
          </AdminCard>
        </div>

        {/* Cards médios (lado a lado) */}
        <div className="md:col-span-6">
          <AdminCard title="Segurança & suporte">
            <div className="space-y-4 text-sm text-fg-muted">
              <Row label="Incidentes de segurança abertos" value={String(incidentesAbertos)} />
              <Row label="Avaliações negativas (nota ≤ 2)" value={String(avaliacoesNegativas)} />
            </div>
          </AdminCard>
        </div>

        <div className="md:col-span-6">
          <AdminCard title="Resumo rápido">
            <AdminEmpty title="Em breve" hint="Espaço para atalhos ou alertas rápidos." />
          </AdminCard>
        </div>
      </AdminGrid>
    </AdminPage>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="text-fg-muted">{label}</div>
      <div className="font-semibold text-fg">{value}</div>
    </div>
  );
}
