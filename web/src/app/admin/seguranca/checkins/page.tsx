export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin-ui/AdminPage";
import { AdminGrid } from "@/components/admin-ui/AdminGrid";
import { AdminCard } from "@/components/admin-ui/AdminCard";
import { AdminEmpty } from "@/components/admin-ui/AdminEmpty";
import { AdminTable } from "@/components/admin-ui/AdminTable";
import { AdminKpi } from "@/components/admin-ui/AdminKpi";
import { Badge, type Tone } from "@/design-system/ui";
import { Signal, ListChecks, MapPinOff, Siren } from "lucide-react";

const SEIS_HORAS_MS = 6 * 60 * 60 * 1000;
const VINTE_QUATRO_HORAS_MS = 24 * 60 * 60 * 1000;

/**
 * CHECKIN_OK não carrega gravidade — é a confirmação de que está tudo bem.
 * O que tem valor operacional aqui é a RECÊNCIA: um check-in das últimas
 * horas é sinal vivo; um antigo já não diz nada sobre o agora.
 */
function recenciaTone(dt: Date): { tone: Tone; label: string } {
  const idade = Date.now() - new Date(dt).getTime();
  if (idade <= SEIS_HORAS_MS) return { tone: "success", label: "Recente" };
  if (idade <= VINTE_QUATRO_HORAS_MS) return { tone: "medium", label: "Hoje" };
  return { tone: "neutral", label: "Antigo" };
}

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
    const recencia = recenciaTone(event.createdAt);
    return {
      id: event.id,
      diarista: event.user?.nome ?? event.user?.telefone ?? event.userId,
      servico: event.serviceId ?? "—",
      servicoLabel: service
        ? `${service.id.slice(0, 6)} · ${service.bairro}, ${service.cidade}/${service.uf}`
        : event.serviceId ?? "—",
      localizacao: fmtLocal(event.lat, event.lng),
      horario: fmt(event.createdAt),
      recenciaTone: recencia.tone,
      recenciaLabel: recencia.label,
    };
  });

  const recentes = rows.filter((r) => r.recenciaTone === "success").length;
  const semLocalizacao = rows.filter((r) => r.localizacao === "—").length;

  return (
    <AdminPage title="Check-ins" subtitle="Eventos de segurança confirmados pelas diaristas">
      <AdminGrid>
        <div className="md:col-span-4">
          <AdminKpi
            label="Nas últimas 6h"
            value={String(recentes)}
            hint="check-ins com sinal recente de campo"
            icon={Signal}
            tone="success"
          />
        </div>
        <div className="md:col-span-4">
          <AdminKpi label="Total registrados" value={String(rows.length)} hint="últimos 50" icon={ListChecks} />
        </div>
        <div className="md:col-span-4">
          <AdminKpi
            label="Sem localização"
            value={String(semLocalizacao)}
            hint={semLocalizacao > 0 ? "GPS não enviado no check-in" : "todos com GPS"}
            icon={MapPinOff}
            tone={semLocalizacao > 0 ? "medium" : "neutral"}
          />
        </div>

        <div className="md:col-span-12">
          <AdminCard title="Últimos check-ins" icon={Siren}>
            {rows.length === 0 ? (
              <AdminEmpty title="Nenhum check-in registrado" hint="Os check-ins feitos no app aparecem aqui." />
            ) : (
              <AdminTable
                columns={[
                  {
                    key: "recenciaLabel",
                    label: "Sinal",
                    render: (row) => <Badge tone={row.recenciaTone}>{row.recenciaLabel}</Badge>,
                  },
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
                          className="font-semibold text-fg underline-offset-2 hover:underline"
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
