import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { IncidentCard } from "./_components/IncidentCard";
import { AdminPage } from "@/components/admin-ui/AdminPage";
import { AdminGrid } from "@/components/admin-ui/AdminGrid";
import { AdminCard } from "@/components/admin-ui/AdminCard";
import { AdminKpi } from "@/components/admin-ui/AdminKpi";
import { AdminEmpty } from "@/components/admin-ui/AdminEmpty";
import { ShieldAlert, Inbox, Search, CheckCircle2, Archive } from "lucide-react";

export const dynamic = "force-dynamic";

const FILTROS = [
  { key: "ABERTO", label: "Abertos" },
  { key: "EM_ANALISE", label: "Em análise" },
  { key: "CONFIRMADO", label: "Confirmados" },
  { key: "ENCERRADO", label: "Encerrados" },
] as const;

export default async function AdminIncidentesPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const pedido = (params.status || "ABERTO").toUpperCase();
  // Só aceita um dos filtros conhecidos: `status` vem da URL e ia direto para
  // o `where` do Prisma como `any` — valor inválido quebrava a consulta.
  const status = FILTROS.find((f) => f.key === pedido)?.key ?? "ABERTO";

  const [incidents, abertos, emAnalise, confirmados, encerrados] = await Promise.all([
    prisma.incidentReport.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
      include: {
        reportedUser: { select: { nome: true, telefone: true } },
        reportedBy: { select: { nome: true, telefone: true } },
      },
      take: 50,
    }),
    prisma.incidentReport.count({ where: { status: "ABERTO" } }),
    prisma.incidentReport.count({ where: { status: "EM_ANALISE" } }),
    prisma.incidentReport.count({ where: { status: "CONFIRMADO" } }),
    prisma.incidentReport.count({ where: { status: "ENCERRADO" } }),
  ]);

  const contagem: Record<string, number> = {
    ABERTO: abertos,
    EM_ANALISE: emAnalise,
    CONFIRMADO: confirmados,
    ENCERRADO: encerrados,
  };

  return (
    <AdminPage title="" subtitle="">
      <AdminGrid>
        <div className="md:col-span-3">
          <AdminKpi
            label="Abertos"
            value={String(abertos)}
            hint="Aguardando triagem"
            icon={Inbox}
            tone={abertos > 0 ? "high" : "neutral"}
          />
        </div>
        <div className="md:col-span-3">
          <AdminKpi
            label="Em análise"
            value={String(emAnalise)}
            hint="Sob apuração"
            icon={Search}
            tone="info"
          />
        </div>
        <div className="md:col-span-3">
          <AdminKpi
            label="Confirmados"
            value={String(confirmados)}
            hint="Denúncia procedente"
            icon={CheckCircle2}
            tone={confirmados > 0 ? "critical" : "neutral"}
          />
        </div>
        <div className="md:col-span-3">
          <AdminKpi
            label="Encerrados"
            value={String(encerrados)}
            hint="Caso finalizado"
            icon={Archive}
            tone="success"
          />
        </div>

        <div className="md:col-span-12">
          <AdminCard
            title="Incidentes"
            icon={ShieldAlert}
            right={
              <div className="flex flex-wrap items-center gap-1">
                {FILTROS.map((f) => (
                  <Link
                    key={f.key}
                    href={`/admin/incidentes?status=${f.key}`}
                    className={
                      f.key === status
                        ? "rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white"
                        : "rounded-full px-3 py-1 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-subtle"
                    }
                  >
                    {f.label}
                    <span className="ml-1.5 tabular-nums opacity-70">{contagem[f.key]}</span>
                  </Link>
                ))}
              </div>
            }
          >
            <p className="mb-4 text-xs leading-relaxed text-fg-subtle">
              Abra um item para ver as evidências (links assinados) e alterar o status.
            </p>

            {incidents.length === 0 ? (
              <AdminEmpty
                title="Nenhum incidente neste filtro"
                hint="Troque o filtro acima para ver outros estados."
              />
            ) : (
              <div className="grid gap-3">
                {incidents.map((item) => (
                  <IncidentCard
                    key={item.id}
                    item={{ ...item, createdAt: item.createdAt.toISOString() }}
                  />
                ))}
              </div>
            )}
          </AdminCard>
        </div>
      </AdminGrid>
    </AdminPage>
  );
}
