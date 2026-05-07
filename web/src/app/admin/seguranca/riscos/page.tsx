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
      usuario: event.user?.nome ?? event.user?.telefone ?? event.userId,
      servico: event.serviceId ?? "—",
      status: "ACIONADO",
      horarioRaw: event.createdAt,
      horario: fmt(event.createdAt),
      href: null as string | null,
    })),
    ...incidents.map((incident) => ({
      id: `incident-${incident.id}`,
      tipo: `${incident.type} · ${incident.severity}`,
      usuario: incident.reportedUser?.nome ?? incident.reportedUser?.telefone ?? "—",
      servico: incident.serviceId ?? "—",
      status: incident.status,
      horarioRaw: incident.createdAt,
      horario: fmt(incident.createdAt),
      href: `/admin/incidentes/${incident.id}`,
    })),
  ].sort((a, b) => b.horarioRaw.getTime() - a.horarioRaw.getTime());

  return (
    <AdminPage title="Riscos" subtitle="SOS e incidentes abertos para acompanhamento rápido">
      <AdminGrid>
        <div className="md:col-span-12">
          <AdminCard title="Fila de risco">
            {rows.length === 0 ? (
              <AdminEmpty title="Nenhum risco ativo" hint="SOS e incidentes abertos aparecem aqui." />
            ) : (
              <AdminTable
                columns={[
                  {
                    key: "tipo",
                    label: "Tipo",
                    render: (row) =>
                      row.href ? (
                        <Link
                          href={row.href}
                          className="font-semibold text-slate-800 underline-offset-2 hover:underline"
                        >
                          {row.tipo}
                        </Link>
                      ) : (
                        row.tipo
                      ),
                  },
                  { key: "usuario", label: "Usuário" },
                  { key: "servico", label: "Serviço" },
                  { key: "status", label: "Status" },
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
