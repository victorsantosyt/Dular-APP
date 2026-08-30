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
import { AdminTable } from "@/components/admin-ui/AdminTable";
import ConcluidosSemanaChart from "./ConcluidosSemanaChart";
import {
  Target, Droplets, Repeat, Timer, TrendingUp, LayoutList,
  Star, BadgeDollarSign, AlertTriangle, MapPin, Award,
} from "lucide-react";

function pct(v: number | null): string {
  return v === null ? "—" : `${v.toFixed(0)}%`;
}

export default async function InsightsPage() {
  const [servicos, eventos, profissionais, avaliacaoAgg, topDiaristasRaw] =
    await Promise.all([
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
      prisma.avaliacao.aggregate({ _avg: { notaGeral: true }, _count: { notaGeral: true } }),
      prisma.avaliacao.groupBy({
        by: ["diaristaId"],
        _avg: { notaGeral: true },
        _count: { _all: true },
        orderBy: { _avg: { notaGeral: "desc" } },
        take: 5,
      }),
    ]);

  const m = computeBetaMetrics({ servicos, eventos, profissionais, agora: new Date() });

  const servicosTotal = servicos.length;
  const andamento = servicos.filter((s) =>
    ["SOLICITADO", "ACEITO", "EM_ANDAMENTO", "AGUARDANDO_FINALIZACAO"].includes(s.status),
  ).length;
  const cancelados = servicos.filter((s) => s.status === "CANCELADO").length;
  const concluidosTotal = servicos.filter((s) =>
    ["CONCLUIDO", "CONFIRMADO", "FINALIZADO"].includes(s.status),
  ).length;

  const diaristaIds = topDiaristasRaw
    .map((d) => d.diaristaId)
    .filter((id): id is string => !!id);
  const diaristas =
    diaristaIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: diaristaIds } },
          select: { id: true, nome: true },
        })
      : [];
  const diaristaById = new Map(diaristas.map((d) => [d.id, d]));

  const bairroCount = new Map<string, { bairro: string; cidade: string; total: number }>();
  for (const s of servicos) {
    const key = `${s.bairro}|${s.cidade}`;
    const atual = bairroCount.get(key);
    if (atual) atual.total += 1;
    else bairroCount.set(key, { bairro: s.bairro || "—", cidade: s.cidade || "—", total: 1 });
  }
  const topBairros = [...bairroCount.values()].sort((a, b) => b.total - a.total).slice(0, 5);

  const topDiaristas = topDiaristasRaw
    .filter((d): d is typeof d & { diaristaId: string } => !!d.diaristaId)
    .map((d) => ({
      diaristaId: d.diaristaId,
      nome: diaristaById.get(d.diaristaId)?.nome ?? "Diarista",
      nota: d._avg.notaGeral ?? 0,
      total: d._count._all,
    }));

  const mediaNota = avaliacaoAgg._avg.notaGeral ?? 0;
  const totalAval = avaliacaoAgg._count.notaGeral ?? 0;

  const variacaoHint =
    m.northStar.variacaoPct === null
      ? `Semana anterior: ${m.northStar.semanaAnterior}`
      : `${m.northStar.variacaoPct >= 0 ? "+" : ""}${m.northStar.variacaoPct.toFixed(0)}% ante a semana anterior (${m.northStar.semanaAnterior})`;

  return (
    <AdminPage title="" subtitle="">
      <AdminGrid>
        <div className="md:col-span-3">
          <AdminKpi
            label="Concluídos esta semana"
            value={String(m.northStar.semanaAtual)}
            hint={variacaoHint}
            icon={Target}
            tone="success"
          />
        </div>
        <div className="md:col-span-3">
          <AdminKpi
            label="Liquidez (28 dias)"
            value={pct(m.liquidez.pct)}
            hint={
              m.liquidez.solicitados === 0
                ? "Sem solicitações nos últimos 28 dias"
                : `${m.liquidez.aceitos} de ${m.liquidez.solicitados} solicitações aceitas (meta: 60%)`
            }
            icon={Droplets}
            tone="info"
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
        <div className="md:col-span-3">
          <AdminKpi
            label="Cadastro até o 1º serviço"
            value={
              m.tempoCadastroPrimeiroServico.medianaDias === null
                ? "—"
                : `${m.tempoCadastroPrimeiroServico.medianaDias} d`
            }
            hint={
              m.tempoCadastroPrimeiroServico.amostra === 0
                ? "Ainda sem amostra suficiente"
                : `Mediana de ${m.tempoCadastroPrimeiroServico.amostra} profissionais`
            }
            icon={Timer}
            tone="info"
          />
        </div>

        <div className="md:col-span-8">
          <AdminCard
            icon={TrendingUp}
            title="Serviços concluídos por semana"
            right={
              <span className="rounded-full bg-accent-subtle px-2.5 py-1 text-eyebrow font-bold uppercase text-accent-strong">
                North Star · 8 semanas
              </span>
            }
          >
            <div className="">
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

        <div className="md:col-span-4">
          <AdminCard title="Visão geral" icon={LayoutList}>
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              <AdminKpi label="Serviços totais" value={String(servicosTotal)} />
              <AdminKpi label="Em andamento" value={String(andamento)} />
              <AdminKpi label="Concluídos" value={String(concluidosTotal)} />
              <AdminKpi label="Cancelados" value={String(cancelados)} />
            </div>
          </AdminCard>
        </div>

        <div className="md:col-span-4">
          <AdminKpi
            label="Avaliação média"
            value={mediaNota ? mediaNota.toFixed(1) : "—"}
            hint={`${totalAval} avaliações`}
            icon={Star}
            tone="medium"
          />
        </div>
        <div className="md:col-span-4">
          <AdminKpi
            label="PIX confirmados"
            value={String(m.pagamentos.confirmados)}
            hint={`${m.pagamentos.informados} informados e ${m.pagamentos.aguardando} aguardando`}
            icon={BadgeDollarSign}
            tone="success"
          />
        </div>
        <div className="md:col-span-4">
          <AdminKpi
            label="PIX contestados"
            value={String(m.pagamentos.contestados)}
            hint={
              m.pagamentos.contestados > 0
                ? "Exigem atenção: ver disputa no chat"
                : "Nenhuma disputa aberta"
            }
            icon={AlertTriangle}
            tone={m.pagamentos.contestados > 0 ? "critical" : "neutral"}
          />
        </div>

        <div className="md:col-span-4">
          <AdminCard title="Top bairros" icon={MapPin}>
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

        <div className="md:col-span-4">
          <AdminCard title="Top diaristas (nota)" icon={Award}>
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

        {/* Conteúdo de avaliação (lista, comentários) vive em /admin/insights/feedbacks —
            aqui ficam só as métricas da operação, para as duas telas não se sobreporem. */}
      </AdminGrid>
    </AdminPage>
  );
}
