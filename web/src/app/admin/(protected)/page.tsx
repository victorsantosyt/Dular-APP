export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import DownloadsArea from "../_ui/DownloadsArea";
import { AdminPage } from "@/components/admin-ui/AdminPage";
import { AdminGrid } from "@/components/admin-ui/AdminGrid";
import { AdminCard } from "@/components/admin-ui/AdminCard";
import { AdminKpi } from "@/components/admin-ui/AdminKpi";
import { AdminEmpty } from "@/components/admin-ui/AdminEmpty";

export default function AdminHomePage() {
  return (
    <AdminPage title="" subtitle="">
      <AdminGrid>
        {/* KPIs (pequenos) */}
        <div className="md:col-span-3">
          <AdminKpi label="Instalações totais" value="21.400" hint="Instalações totais" />
        </div>
        <div className="md:col-span-3">
          <AdminKpi label="Instalações nos últimos 30 dias" value="+1.256" hint="+ 6,2%" />
        </div>
        <div className="md:col-span-3">
          <AdminKpi label="Avaliação" value="4.8" hint="★★★★★" />
        </div>
        <div className="md:col-span-3">
          <AdminKpi label="Retenção de Usuários" value="75,4%" hint="+ 2,5%" />
        </div>

        {/* Card grande - ocupa a linha inteira */}
        <div className="md:col-span-12">
          <AdminCard
            title="Downloads Totais"
            right={
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="rounded-full bg-emerald-200/60 px-3 py-1 font-semibold text-emerald-900">
                  Últimos 30 dias
                </span>
                <span className="rounded-full bg-white/60 px-3 py-1">Últimos 12 meses</span>
              </div>
            }
          >
            <div className="rounded-2xl border border-white/50 bg-white/50 p-2">
              <DownloadsArea />
            </div>
          </AdminCard>
        </div>

        {/* Cards médios (lado a lado) */}
        <div className="md:col-span-6">
          <AdminCard title="Problemas">
            <div className="space-y-4 text-sm text-slate-700">
              <Row label="Foram reportados 45 bugs" delta="+5%" />
              <Row label="A estabilidade do app está 98,2%" delta="+0,8%" />
              <Row label="Foram recebidas 52 avaliações negativas" delta="+8,3%" />
              <Row label="Foram canceladas 26 assinaturas" delta="+2,7%" />
            </div>
            <button className="mt-6 w-full rounded-2xl bg-white/55 py-2 text-sm font-semibold text-slate-700 ring-1 ring-white/40 hover:bg-white/70">
              Ver todos
            </button>
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

function Row({ label, delta }: { label: string; delta: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="text-slate-700">{label}</div>
      <div className="text-emerald-700 font-semibold">{delta}</div>
    </div>
  );
}
