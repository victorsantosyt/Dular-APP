export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin-ui/AdminPage";
import { AdminGrid } from "@/components/admin-ui/AdminGrid";
import { AdminCard } from "@/components/admin-ui/AdminCard";
import { AdminEmpty } from "@/components/admin-ui/AdminEmpty";
import { AdminTable } from "@/components/admin-ui/AdminTable";

function fmt(dt: Date) {
  return new Date(dt).toLocaleString("pt-BR");
}

function fmtLocal(lat: number | null, lng: number | null) {
  if (lat == null || lng == null) return "—";
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export default async function CheckinsPage() {
  const events = await prisma.safetyEvent.findMany({
    where: { type: "CHECKIN_OK" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      userId: true,
      serviceId: true,
      lat: true,
      lng: true,
      createdAt: true,
      user: { select: { nome: true, telefone: true } },
    },
  });

  const serviceIds = [...new Set(events.map((event) => event.serviceId).filter(Boolean))] as string[];
  const services = serviceIds.length
    ? await prisma.servico.findMany({
        where: { id: { in: serviceIds } },
        select: { id: true, bairro: true, cidade: true, uf: true, status: true },
      })
    : [];
  const servicesById = new Map(services.map((service) => [service.id, service]));

  const rows = events.map((event) => {
    const service = event.serviceId ? servicesById.get(event.serviceId) : null;
    return {
      id: event.id,
      diarista: event.user?.nome ?? event.user?.telefone ?? event.userId,
      servico: event.serviceId ?? "—",
      servicoLabel: service
        ? `${service.id.slice(0, 6)} · ${service.bairro}, ${service.cidade}/${service.uf}`
        : event.serviceId ?? "—",
      localizacao: fmtLocal(event.lat, event.lng),
      horario: fmt(event.createdAt),
    };
  });

  return (
    <AdminPage title="Check-ins" subtitle="Eventos de segurança confirmados pelas diaristas">
      <AdminGrid>
        <div className="md:col-span-12">
          <AdminCard title="Últimos check-ins">
            {rows.length === 0 ? (
              <AdminEmpty title="Nenhum check-in registrado" hint="Os check-ins feitos no app aparecem aqui." />
            ) : (
              <AdminTable
                columns={[
                  { key: "diarista", label: "Diarista" },
                  { key: "servicoLabel", label: "Serviço" },
                  {
                    key: "localizacao",
                    label: "Localização",
                    render: (row) =>
                      row.localizacao === "—" ? (
                        "—"
                      ) : (
                        <a
                          href={`https://www.google.com/maps?q=${row.localizacao}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-slate-800 underline-offset-2 hover:underline"
                        >
                          {row.localizacao}
                        </a>
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
