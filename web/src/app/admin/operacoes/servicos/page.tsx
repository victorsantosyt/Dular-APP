export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin-ui/AdminPage";
import { AdminGrid } from "@/components/admin-ui/AdminGrid";
import { AdminKpi } from "@/components/admin-ui/AdminKpi";
import { AdminCard } from "@/components/admin-ui/AdminCard";
import { AdminTable } from "@/components/admin-ui/AdminTable";
import { AdminEmpty } from "@/components/admin-ui/AdminEmpty";

export default async function ServicosPage() {
  const [
    abertos,
    andamento,
    concluidos,
    finalizados,
    totalSolicitados,
    eventosAceite,
    eventosConcluido,
    eventosConfirmado,
    rows,
  ] = await Promise.all([
    prisma.servico.count({ where: { status: { in: ["SOLICITADO", "ACEITO"] } } }),
    prisma.servico.count({ where: { status: "EM_ANDAMENTO" } }),
    prisma.servico.count({ where: { status: { in: ["CONCLUIDO", "CONFIRMADO"] } } }),
    prisma.servico.count({ where: { status: "FINALIZADO" } }),
    prisma.servico.count({ where: { status: "SOLICITADO" } }),
    prisma.servicoEvento.findMany({
      where: { toStatus: "ACEITO" },
      select: { createdAt: true, servico: { select: { createdAt: true } } },
    }),
    prisma.servicoEvento.findMany({
      where: { toStatus: "CONFIRMADO" },
      select: { servicoId: true, createdAt: true },
    }),
    prisma.servicoEvento.findMany({
      where: { toStatus: "CONCLUIDO" },
      select: { servicoId: true, createdAt: true },
    }),
    prisma.servico.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true,
        status: true,
        cidade: true,
        bairro: true,
        createdAt: true,
        cliente: { select: { nome: true } },
        diarista: { select: { nome: true } },
      },
    }),
  ]);

  const tempoAceiteMin = (() => {
    if (eventosAceite.length === 0) return null;
    const diffMs = eventosAceite
      .map((ev) => ev.createdAt.getTime() - ev.servico.createdAt.getTime())
      .filter((n) => n > 0);
    if (diffMs.length === 0) return null;
    return Math.round(diffMs.reduce((a, b) => a + b, 0) / diffMs.length / 60000);
  })();

  const tempoConfirmadoMin = (() => {
    if (eventosConfirmado.length === 0 || eventosConcluido.length === 0) return null;
    const concluidosMap = new Map<string, number>();
    eventosConcluido.forEach((ev) => {
      if (!concluidosMap.has(ev.servicoId)) {
        concluidosMap.set(ev.servicoId, ev.createdAt.getTime());
      }
    });

    const diffs: number[] = [];
    eventosConfirmado.forEach((ev) => {
      const from = concluidosMap.get(ev.servicoId);
      if (!from) return;
      const diff = ev.createdAt.getTime() - from;
      if (diff > 0) diffs.push(diff);
    });

    if (diffs.length === 0) return null;
    return Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length / 60000);
  })();

  const taxaConclusao = totalSolicitados
    ? Math.round((finalizados / totalSolicitados) * 100)
    : null;

  return (
    <AdminPage title="" subtitle="">
      <AdminGrid>
        <div className="md:col-span-3">
          <AdminKpi label="Abertos" value={String(abertos)} hint="SOLICITADO / ACEITO" />
        </div>
        <div className="md:col-span-3">
          <AdminKpi label="Em andamento" value={String(andamento)} hint="EM_ANDAMENTO" />
        </div>
        <div className="md:col-span-3">
          <AdminKpi label="Concluídos" value={String(concluidos)} hint="CONCLUIDO / CONFIRMADO" />
        </div>
        <div className="md:col-span-3">
          <AdminKpi label="Finalizados" value={String(finalizados)} hint="FINALIZADO" />
        </div>
        <div className="md:col-span-3">
          <AdminKpi
            label="Tempo médio até ACEITO"
            value={tempoAceiteMin != null ? `${tempoAceiteMin} min` : "—"}
            hint="SOLICITADO → ACEITO"
          />
        </div>
        <div className="md:col-span-3">
          <AdminKpi
            label="Tempo médio CONCLUIDO → CONFIRMADO"
            value={tempoConfirmadoMin != null ? `${tempoConfirmadoMin} min` : "—"}
            hint="Concluído pela diarista até confirmação do cliente"
          />
        </div>
        <div className="md:col-span-3">
          <AdminKpi
            label="Taxa de conclusão"
            value={taxaConclusao != null ? `${taxaConclusao}%` : "—"}
            hint="FINALIZADO / SOLICITADO"
          />
        </div>

        <div className="md:col-span-12">
          <AdminCard title="Serviços recentes">
            {rows.length === 0 ? (
              <AdminEmpty title="Sem serviços ainda" hint="Assim que o piloto rodar, aparece aqui." />
            ) : (
              <AdminTable
                columns={[
                  {
                    key: "id",
                    label: "ID",
                    render: (r) => (
                      <a
                        href={`/admin/operacoes/servicos/${r.id}`}
                        className="font-semibold text-slate-800 underline-offset-2 hover:underline"
                      >
                        {r.id.slice(0, 6)}
                      </a>
                    ),
                  },
                  { key: "status", label: "Status" },
                  { key: "cliente", label: "Cliente", render: (r) => r.cliente?.nome ?? "—" },
                  { key: "diarista", label: "Diarista", render: (r) => r.diarista?.nome ?? "—" },
                  { key: "bairro", label: "Bairro", render: (r) => `${r.bairro ?? "—"} / ${r.cidade ?? "—"}` },
                  {
                    key: "createdAt",
                    label: "Criado em",
                    render: (r) => new Date(r.createdAt).toLocaleString("pt-BR"),
                  },
                ]}
                rows={rows}
              />
            )}
          </AdminCard>
        </div>
      </AdminGrid>
    </AdminPage>
  );
}
