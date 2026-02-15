export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin-ui/AdminPage";
import { AdminGrid } from "@/components/admin-ui/AdminGrid";
import { AdminCard } from "@/components/admin-ui/AdminCard";
import { AdminEmpty } from "@/components/admin-ui/AdminEmpty";

function fmt(dt: Date | null | undefined) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString("pt-BR");
  } catch {
    return "—";
  }
}

export default async function VerificacoesPage() {
  const [pendentes, aprovados, reprovados] = await Promise.all([
    prisma.diaristaProfile.findMany({
      where: { verificacao: "PENDENTE" },
      orderBy: { createdAt: "asc" },
      select: {
        userId: true,
        verificacao: true,
        createdAt: true,
        user: { select: { nome: true, telefone: true } },
      },
    }),
    prisma.diaristaProfile.findMany({
      where: { verificacao: "VERIFICADO" },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        userId: true,
        verificacao: true,
        updatedAt: true,
        user: { select: { nome: true, telefone: true } },
      },
    }),
    prisma.diaristaProfile.findMany({
      where: { verificacao: "REPROVADO" },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        userId: true,
        verificacao: true,
        updatedAt: true,
        user: { select: { nome: true, telefone: true } },
      },
    }),
  ]);

  return (
    <AdminPage title="Verificações" subtitle="Aprovação de diaristas (KYC)">
      <AdminGrid>
        <div className="md:col-span-12">
          <AdminCard title="Pendentes">
            {pendentes.length === 0 ? (
              <AdminEmpty title="Nenhum pendente" hint="Quando houver diaristas pendentes, aparecem aqui." />
            ) : (
              <div className="space-y-3">
                {pendentes.map((p) => (
                  <div
                    key={p.userId}
                    className="rounded-xl border border-white/40 bg-white/70 p-3 ring-1 ring-slate-900/5"
                  >
                    <div className="text-sm text-slate-800">
                      <div className="font-semibold">{p.user?.nome ?? "Diarista"}</div>
                      <div className="text-xs text-slate-500">{p.user?.telefone ?? "—"}</div>
                      <div className="text-xs text-slate-500">Criado: {fmt(p.createdAt)}</div>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <form action="/api/admin/verificacoes/approve" method="POST" className="space-y-2">
                        <input type="hidden" name="id" value={p.userId} />
                        <label className="text-xs text-slate-500">Motivo da aprovação</label>
                        <textarea
                          name="motivo"
                          required
                          className="w-full rounded-xl border border-white/30 bg-white/60 px-3 py-2 text-sm text-slate-800 outline-none ring-1 ring-slate-900/5 focus:ring-2 focus:ring-emerald-500/25"
                          placeholder="Documentos ok"
                          rows={2}
                        />
                        <button className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm ring-1 ring-white/30 hover:brightness-95 active:brightness-90">
                          Aprovar
                        </button>
                      </form>
                      <form action="/api/admin/verificacoes/reprove" method="POST" className="space-y-2">
                        <input type="hidden" name="id" value={p.userId} />
                        <label className="text-xs text-slate-500">Motivo da reprovação</label>
                        <textarea
                          name="motivo"
                          required
                          className="w-full rounded-xl border border-white/30 bg-white/60 px-3 py-2 text-sm text-slate-800 outline-none ring-1 ring-slate-900/5 focus:ring-2 focus:ring-red-500/25"
                          placeholder="Documento ilegível"
                          rows={2}
                        />
                        <button className="rounded-xl border border-white/40 bg-white/60 px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm ring-1 ring-slate-900/5 hover:bg-white/75 active:bg-white/80">
                          Reprovar
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AdminCard>
        </div>

        <div className="md:col-span-6">
          <AdminCard title="Aprovados (últimos 10)">
            {aprovados.length === 0 ? (
              <AdminEmpty title="Nenhum aprovado ainda" />
            ) : (
              <ul className="space-y-2 text-sm text-slate-800">
                {aprovados.map((a) => (
                  <li key={a.userId} className="flex items-center justify-between rounded-xl bg-white/60 px-3 py-2 ring-1 ring-slate-900/5">
                    <div>
                      <div className="font-semibold">{a.user?.nome ?? "Diarista"}</div>
                      <div className="text-xs text-slate-500">{a.user?.telefone ?? "—"}</div>
                    </div>
                    <div className="text-xs text-slate-500">Atualizado: {fmt(a.updatedAt)}</div>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
        </div>

        <div className="md:col-span-6">
          <AdminCard title="Reprovados (últimos 10)">
            {reprovados.length === 0 ? (
              <AdminEmpty title="Nenhum reprovado" />
            ) : (
              <ul className="space-y-2 text-sm text-slate-800">
                {reprovados.map((a) => (
                  <li key={a.userId} className="flex items-center justify-between rounded-xl bg-white/60 px-3 py-2 ring-1 ring-slate-900/5">
                    <div>
                      <div className="font-semibold">{a.user?.nome ?? "Diarista"}</div>
                      <div className="text-xs text-slate-500">{a.user?.telefone ?? "—"}</div>
                    </div>
                    <div className="text-xs text-slate-500">Atualizado: {fmt(a.updatedAt)}</div>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
        </div>
      </AdminGrid>
    </AdminPage>
  );
}
