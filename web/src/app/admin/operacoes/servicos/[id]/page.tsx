export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin-ui/AdminPage";
import { AdminGrid } from "@/components/admin-ui/AdminGrid";
import { AdminCard } from "@/components/admin-ui/AdminCard";
import { AdminEmpty } from "@/components/admin-ui/AdminEmpty";

type Props = {
  params: { id: string };
};

const STATUS_LABEL: Record<string, string> = {
  SOLICITADO: "Solicitado",
  ACEITO: "Aceito",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDO: "Concluído",
  CONFIRMADO: "Confirmado",
  FINALIZADO: "Finalizado",
  CANCELADO: "Cancelado",
};

function fmtDate(dt: Date | null | undefined) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString("pt-BR");
  } catch {
    return "—";
  }
}

export default async function ServicoDetalhePage({ params }: Props) {
  const { id } = params;

  const servico = await prisma.servico.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      tipo: true,
      categoria: true,
      data: true,
      turno: true,
      cidade: true,
      uf: true,
      bairro: true,
      enderecoCompleto: true,
      observacoes: true,
      precoFinal: true,
      createdAt: true,
      updatedAt: true,
      cliente: { select: { id: true, nome: true, telefone: true } },
      diarista: { select: { id: true, nome: true, telefone: true } },
      eventos: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          fromStatus: true,
          toStatus: true,
          actorRole: true,
          actorId: true,
          createdAt: true,
        },
      },
    },
  });

  if (!servico) {
    return notFound();
  }

  const statusLabel = STATUS_LABEL[servico.status] ?? servico.status;

  return (
    <AdminPage
      title={`Serviço #${servico.id.slice(0, 8)}`}
      subtitle={`Status: ${statusLabel}`}
      right={
        <Link
          href="/admin/operacoes/servicos"
          className="rounded-xl border border-white/40 bg-white/70 px-3 py-2 text-sm text-slate-700 shadow-sm ring-1 ring-slate-900/5 hover:bg-white/80"
        >
          ← Voltar
        </Link>
      }
    >
      <AdminGrid>
        <div className="md:col-span-6">
          <AdminCard title="Dados do serviço">
            <div className="space-y-2 text-sm text-slate-700">
              <div>
                <b>Tipo:</b> {servico.tipo}
              </div>
              <div>
                <b>Categoria:</b> {servico.categoria ?? "—"}
              </div>
              <div>
                <b>Data / turno:</b> {fmtDate(servico.data)} • {servico.turno}
              </div>
              <div>
                <b>Local:</b> {servico.bairro}, {servico.cidade} / {servico.uf}
              </div>
              <div>
                <b>Endereço:</b> {servico.enderecoCompleto || "—"}
              </div>
              <div>
                <b>Preço final:</b> R$ {(servico.precoFinal / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <div>
                <b>Criado em:</b> {fmtDate(servico.createdAt)}
              </div>
              <div>
                <b>Atualizado em:</b> {fmtDate(servico.updatedAt)}
              </div>
              <div>
                <b>Observações:</b> {servico.observacoes || "—"}
              </div>
            </div>
          </AdminCard>
        </div>

        <div className="md:col-span-6">
          <AdminCard title="Pessoas">
            <div className="space-y-3 text-sm text-slate-700">
              <div>
                <div className="text-xs text-slate-500">Cliente</div>
                <div className="font-semibold">{servico.cliente?.nome || "—"}</div>
                <div className="text-xs text-slate-500">{servico.cliente?.telefone || "—"}</div>
              </div>
              <div className="h-px bg-white/40" />
              <div>
                <div className="text-xs text-slate-500">Diarista</div>
                <div className="font-semibold">{servico.diarista?.nome || "—"}</div>
                <div className="text-xs text-slate-500">{servico.diarista?.telefone || "—"}</div>
              </div>
            </div>
          </AdminCard>
        </div>

        <div className="md:col-span-12">
          <AdminCard title="Timeline do serviço">
            {servico.eventos.length === 0 ? (
              <AdminEmpty title="Sem eventos registrados" hint="Quando o fluxo rodar, os eventos aparecem aqui." />
            ) : (
              <ol className="space-y-3">
                {servico.eventos.map((ev) => (
                  <li key={ev.id} className="rounded-xl border border-white/40 bg-white/60 px-3 py-2 ring-1 ring-slate-900/5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">
                          {STATUS_LABEL[ev.fromStatus] ?? ev.fromStatus} → {STATUS_LABEL[ev.toStatus] ?? ev.toStatus}
                        </div>
                        <div className="text-xs text-slate-500">
                          Ator: {ev.actorRole} {ev.actorId ? `(${ev.actorId})` : ""}
                        </div>
                      </div>
                      <div className="text-xs text-slate-500">{fmtDate(ev.createdAt)}</div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </AdminCard>
        </div>

        <div className="md:col-span-12">
          <AdminCard title="Ações administrativas">
            <div className="grid gap-3 md:grid-cols-2">
              <form action="/api/admin/servicos/cancelar" method="POST" className="space-y-2">
                <input type="hidden" name="id" value={servico.id} />
                <label className="text-xs text-slate-500">Motivo do cancelamento</label>
                <textarea
                  name="motivo"
                  className="w-full rounded-xl border border-white/30 bg-white/60 px-3 py-2 text-sm text-slate-800 outline-none ring-1 ring-slate-900/5 focus:ring-2 focus:ring-slate-900/20"
                  placeholder="Ex: cliente solicitou cancelamento"
                  rows={3}
                />
                <button className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-white/30 hover:brightness-95 active:brightness-90">
                  Cancelar serviço (forçado)
                </button>
              </form>

              <form action="/api/admin/servicos/disputa" method="POST" className="space-y-2">
                <input type="hidden" name="id" value={servico.id} />
                <label className="text-xs text-slate-500">Marcar como disputa (motivo)</label>
                <textarea
                  name="motivo"
                  className="w-full rounded-xl border border-white/30 bg-white/60 px-3 py-2 text-sm text-slate-800 outline-none ring-1 ring-slate-900/5 focus:ring-2 focus:ring-slate-900/20"
                  placeholder="Ex: divergência cliente/diarista"
                  rows={3}
                />
                <button className="rounded-xl border border-white/30 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-900/5 hover:bg-white/80 active:bg-white/85">
                  Marcar como disputa
                </button>
              </form>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Ações são registradas na timeline. Cancelamento muda status para CANCELADO.
            </div>
          </AdminCard>
        </div>
      </AdminGrid>
    </AdminPage>
  );
}
