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

export default async function SuportePage() {
  const incidents = await prisma.incidentReport.findMany({
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
      reportedBy: { select: { nome: true, telefone: true } },
      reportedUser: { select: { nome: true, telefone: true } },
    },
  });

  return (
    <AdminPage title="Suporte" subtitle="Incidentes abertos ou em análise">
      <AdminGrid>
        <div className="md:col-span-12">
          <AdminCard title="Fila de atendimento">
            {incidents.length === 0 ? (
              <AdminEmpty title="Nenhum incidente na fila" hint="Incidentes abertos ou em análise aparecem aqui." />
            ) : (
              <AdminTable
                columns={[
                  {
                    key: "id",
                    label: "Incidente",
                    render: (row) => (
                      <Link
                        href={`/admin/incidentes/${row.id}`}
                        className="font-semibold text-slate-800 underline-offset-2 hover:underline"
                      >
                        {row.id.slice(0, 6)}
                      </Link>
                    ),
                  },
                  { key: "type", label: "Tipo", render: (row) => `${row.type} · ${row.severity}` },
                  { key: "status", label: "Status" },
                  { key: "reportedBy", label: "Relatado por", render: (row) => row.reportedBy?.nome ?? row.reportedBy?.telefone ?? "—" },
                  { key: "reportedUser", label: "Denunciado", render: (row) => row.reportedUser?.nome ?? row.reportedUser?.telefone ?? "—" },
                  { key: "serviceId", label: "Serviço", render: (row) => row.serviceId ?? "—" },
                  { key: "createdAt", label: "Criado em", render: (row) => fmt(row.createdAt) },
                ]}
                rows={incidents}
              />
            )}
          </AdminCard>
        </div>
      </AdminGrid>
    </AdminPage>
  );
}
