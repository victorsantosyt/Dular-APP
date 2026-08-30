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
import { Users, UserPlus, Star, Repeat, TrendingUp, ShieldAlert, Zap } from "lucide-react";

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
          <AdminKpi label="Usuários cadastrados" value={String(usuariosTotal)} icon={Users} />
        </div>
        <div className="md:col-span-3">
          <AdminKpi
            label="Novos usuários (30 dias)"
            value={`+${usuariosNovos30d}`}
            icon={UserPlus}
            tone="info"
          />
        </div>
        <div className="md:col-span-3">
          <AdminKpi
            label="Avaliação média"
            value={mediaNota ? mediaNota.toFixed(1) : "—"}
            hint={totalAval === 1 ? "1 avaliação" : `${totalAval} avaliações`}
            icon={Star}
            tone="medium"
          />
        </div>
        <div className="md:col-span-3">
          <AdminKpi
            label="Retenção de profissionais"
            value={pct(m.retencao.pct)}
            hint={
              m.retencao.ativosSemanaBase === 0
                ? "Sem profissionais ativos na semana de referência"
                : `${m.retencao.retidos} de ${m.retencao.ativosSemanaBase} voltaram a atender (meta: 30%)`
            }
            icon={Repeat}
            tone="success"
          />
        </div>

        {/* Card grande - ocupa a linha inteira */}
        <div className="md:col-span-12">
          <AdminCard
            icon={TrendingUp}
            title="Serviços concluídos por semana"
            right={
              <span className="rounded-full bg-accent-subtle px-2.5 py-1 text-eyebrow font-bold uppercase text-accent-strong">
                North Star · 8 semanas
              </span>
            }
          >
            <div>
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
          <AdminCard title="Segurança & suporte" icon={ShieldAlert}>
            <div className="divide-y divide-border-subtle">
              <Row label="Incidentes de segurança abertos" value={String(incidentesAbertos)} />
              <Row label="Avaliações negativas (nota 1 ou 2)" value={String(avaliacoesNegativas)} />
            </div>
          </AdminCard>
        </div>

        <div className="md:col-span-6">
          <AdminCard title="Resumo rápido" icon={Zap}>
            <AdminEmpty title="Em breve" hint="Espaço para atalhos ou alertas rápidos." />
          </AdminCard>
        </div>
      </AdminGrid>
    </AdminPage>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="text-sm text-fg-muted">{label}</div>
      <div className="text-sm font-bold tabular-nums text-fg">{value}</div>
    </div>
  );
}
