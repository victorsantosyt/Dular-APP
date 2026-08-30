export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin-ui/AdminPage";
import { AdminGrid } from "@/components/admin-ui/AdminGrid";
import { AdminCard } from "@/components/admin-ui/AdminCard";
import { AdminKpi } from "@/components/admin-ui/AdminKpi";
import { AdminEmpty } from "@/components/admin-ui/AdminEmpty";
import { Star, MessageSquareText, ThumbsDown } from "lucide-react";

const FILTROS = [
  { key: "todas", label: "Todas" },
  { key: "negativas", label: "Negativas" },
  { key: "neutras", label: "Neutras" },
  { key: "positivas", label: "Positivas" },
] as const;

type FiltroKey = (typeof FILTROS)[number]["key"];

function whereDoFiltro(filtro: FiltroKey) {
  if (filtro === "negativas") return { notaGeral: { lte: 2 } };
  if (filtro === "neutras") return { notaGeral: 3 };
  if (filtro === "positivas") return { notaGeral: { gte: 4 } };
  return {};
}

/** Estrelas preenchidas/vazias — leitura imediata da nota, sem depender do número. */
function Estrelas({ nota }: { nota: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Nota ${nota} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          aria-hidden
          className={i <= nota ? "text-warning" : "text-border"}
          style={{ fontSize: 13, lineHeight: 1 }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

export default async function FeedbacksPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const params = await searchParams;
  const filtro = (FILTROS.find((f) => f.key === params.filtro)?.key ?? "todas") as FiltroKey;

  const [agg, negativas, lista] = await Promise.all([
    prisma.avaliacao.aggregate({ _avg: { notaGeral: true }, _count: { notaGeral: true } }),
    prisma.avaliacao.count({ where: { notaGeral: { lte: 2 } } }),
    prisma.avaliacao.findMany({
      where: whereDoFiltro(filtro),
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        notaGeral: true,
        comentario: true,
        createdAt: true,
        servico: {
          select: {
            id: true,
            bairro: true,
            cidade: true,
            cliente: { select: { nome: true } },
            diarista: { select: { nome: true } },
          },
        },
      },
    }),
  ]);

  const nota = agg._avg.notaGeral ?? 0;
  const total = agg._count.notaGeral ?? 0;

  return (
    <AdminPage title="" subtitle="">
      <AdminGrid>
        <div className="md:col-span-4">
          <AdminKpi
            label="Avaliação média"
            value={nota ? nota.toFixed(1) : "—"}
            hint={total === 0 ? "Ainda sem avaliações" : total === 1 ? "De 1 avaliação" : `De ${total} avaliações`}
            icon={Star}
            tone="medium"
          />
        </div>
        <div className="md:col-span-4">
          <AdminKpi label="Total de avaliações" value={String(total)} icon={MessageSquareText} />
        </div>
        <div className="md:col-span-4">
          <AdminKpi
            label="Negativas (nota 1 ou 2)"
            value={String(negativas)}
            hint={negativas > 0 ? "Exigem atenção da operação" : "Nenhuma no período"}
            icon={ThumbsDown}
            tone={negativas > 0 ? "critical" : "neutral"}
          />
        </div>

        <div className="md:col-span-12">
          <AdminCard
            title="Avaliações"
            icon={MessageSquareText}
            right={
              <div className="flex flex-wrap items-center gap-1">
                {FILTROS.map((f) => (
                  <Link
                    key={f.key}
                    href={f.key === "todas" ? "?" : `?filtro=${f.key}`}
                    scroll={false}
                    className={
                      f.key === filtro
                        ? "rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white"
                        : "rounded-full px-3 py-1 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-subtle"
                    }
                  >
                    {f.label}
                  </Link>
                ))}
              </div>
            }
          >
            {lista.length === 0 ? (
              <AdminEmpty
                title="Nenhuma avaliação neste filtro"
                hint="Troque o filtro acima ou aguarde novas avaliações."
              />
            ) : (
              <ul className="divide-y divide-border-subtle">
                {lista.map((a) => (
                  <li key={a.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <Estrelas nota={a.notaGeral} />
                        <span className="text-sm font-semibold tabular-nums text-fg">
                          {a.notaGeral}/5
                        </span>
                      </div>
                      <time className="shrink-0 text-xs tabular-nums text-fg-subtle">
                        {new Date(a.createdAt).toLocaleDateString("pt-BR")}
                      </time>
                    </div>

                    {a.comentario?.trim() ? (
                      <p className="mt-2 text-sm leading-relaxed text-fg">{a.comentario}</p>
                    ) : (
                      <p className="mt-2 text-sm italic text-fg-disabled">Sem comentário.</p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-subtle">
                      <span>
                        Cliente <span className="text-fg-muted">{a.servico?.cliente?.nome ?? "—"}</span>
                      </span>
                      <span aria-hidden className="text-border">|</span>
                      <span>
                        Profissional{" "}
                        <span className="text-fg-muted">{a.servico?.diarista?.nome ?? "—"}</span>
                      </span>
                      <span aria-hidden className="text-border">|</span>
                      <span>
                        {a.servico?.bairro ?? "—"}, {a.servico?.cidade ?? "—"}
                      </span>
                      {a.servico?.id ? (
                        <>
                          <span aria-hidden className="text-border">|</span>
                          <Link
                            href={`/admin/operacoes/servicos/${a.servico.id}`}
                            className="font-semibold text-accent-strong hover:underline"
                          >
                            ver serviço
                          </Link>
                        </>
                      ) : null}
                    </div>
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
