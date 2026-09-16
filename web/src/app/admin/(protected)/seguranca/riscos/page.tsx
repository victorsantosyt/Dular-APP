export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin-ui/AdminPage";
import { AdminGrid } from "@/components/admin-ui/AdminGrid";
import { AdminCard } from "@/components/admin-ui/AdminCard";
import { AdminEmpty } from "@/components/admin-ui/AdminEmpty";
import { AdminTable } from "@/components/admin-ui/AdminTable";
import { AdminKpi } from "@/components/admin-ui/AdminKpi";
import {
  Badge,
  gravidadeTone,
  incidenteStatusTone,
  rotuloEnum,
  type Tone,
} from "@/design-system/ui";
import { Siren, AlertTriangle, ListChecks, Radar } from "lucide-react";

function fmt(dt: Date) {
  return new Date(dt).toLocaleString("pt-BR");
}

export default async function RiscosPage() {
  const [sosEvents, incidents] = await Promise.all([
    prisma.safetyEvent.findMany({
      where: { type: "SOS_SILENT" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        userId: true,
        serviceId: true,
        createdAt: true,
        user: { select: { nome: true, telefone: true } },
      },
    }),
    prisma.incidentReport.findMany({
      where: { status: { in: ["ABERTO", "EM_ANALISE"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        severity: true,
        status: true,
        serviceId: true,
        createdAt: true,
        reportedUser: { select: { nome: true, telefone: true } },
      },
    }),
  ]);

  const rows = [
    ...sosEvents.map((event) => ({
      id: `sos-${event.id}`,
      tipo: "SOS",
      // SOS é sempre o topo da escala: acionamento silencioso em campo.
      prioridade: "CRITICA",
      prioridadeTone: "critical" as Tone,
      usuario: event.user?.nome ?? event.user?.telefone ?? event.userId,
      servico: event.serviceId ?? "—",
      status: "ACIONADO",
      statusTone: "critical" as Tone,
      horarioRaw: event.createdAt,
      horario: fmt(event.createdAt),
      href: null as string | null,
    })),
    ...incidents.map((incident) => ({
      id: `incident-${incident.id}`,
      tipo: rotuloEnum(incident.type),
      prioridade: incident.severity,
      prioridadeTone: gravidadeTone(incident.severity),
      usuario: incident.reportedUser?.nome ?? incident.reportedUser?.telefone ?? "—",
      servico: incident.serviceId ?? "—",
      status: incident.status,
      statusTone: incidenteStatusTone(incident.status),
      horarioRaw: incident.createdAt,
      horario: fmt(incident.createdAt),
      href: `/admin/incidentes/${incident.id}`,
    })),
  ].sort((a, b) => {
    // Ordena por prioridade (crítico primeiro) e só depois por recência —
    // uma fila de risco tem de mostrar o mais grave no topo, não o mais novo.
    const peso: Record<string, number> = { CRITICA: 0, ALTA: 1, MEDIA: 2, BAIXA: 3 };
    const pa = peso[(a.prioridade ?? "").toUpperCase()] ?? 4;
    const pb = peso[(b.prioridade ?? "").toUpperCase()] ?? 4;
    if (pa !== pb) return pa - pb;
    return b.horarioRaw.getTime() - a.horarioRaw.getTime();
  });

  const criticos = rows.filter((r) => r.prioridadeTone === "critical").length;
  const altos = rows.filter((r) => r.prioridadeTone === "high").length;

  return (
    <AdminPage title="Riscos" subtitle="SOS e incidentes abertos para acompanhamento rápido">
      <AdminGrid>
        <div className="md:col-span-4">
          <AdminKpi
            label="Críticos"
            value={String(criticos)}
            hint={criticos > 0 ? "SOS ou incidente grave: agir agora" : "Nenhum no momento"}
            icon={Siren}
            tone={criticos > 0 ? "critical" : "neutral"}
          />
        </div>
        <div className="md:col-span-4">
          <AdminKpi label="Alta prioridade" value={String(altos)} icon={AlertTriangle} tone={altos > 0 ? "high" : "neutral"} />
        </div>
        <div className="md:col-span-4">
          <AdminKpi label="Total na fila" value={String(rows.length)} icon={ListChecks} />
        </div>

        <div className="md:col-span-12">
          <AdminCard title="Fila de risco" icon={Radar}>
            {rows.length === 0 ? (
              <AdminEmpty title="Nenhum risco ativo" hint="SOS e incidentes abertos aparecem aqui." />
            ) : (
              <AdminTable
                columns={[
                  {
                    key: "prioridade",
                    label: "Prioridade",
                    render: (row) => (
                      <Badge tone={row.prioridadeTone}>{rotuloEnum(row.prioridade)}</Badge>
                    ),
                  },
                  {
                    key: "tipo",
                    label: "Tipo",
                    render: (row) =>
                      row.href ? (
                        <Link
                          href={row.href}
                          className="font-semibold text-fg underline-offset-2 hover:underline"
                        >
                          {row.tipo}
                        </Link>
                      ) : (
                        <span className="font-semibold text-fg">{row.tipo}</span>
                      ),
                  },
                  { key: "usuario", label: "Usuário" },
                  { key: "servico", label: "Serviço" },
                  {
                    key: "status",
                    label: "Status",
                    render: (row) => (
                      <Badge tone={row.statusTone}>{rotuloEnum(row.status)}</Badge>
                    ),
                  },
                  { key: "horario", label: "Horário" },
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
