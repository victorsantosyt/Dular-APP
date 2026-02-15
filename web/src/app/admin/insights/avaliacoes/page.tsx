import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function fmt1(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toFixed(1).replace(".", ",");
}

function pct(part: number, total: number) {
  if (!total) return "0%";
  const v = Math.round((part / total) * 100);
  return `${v}%`;
}

function stars(n: number) {
  const full = "★".repeat(Math.max(0, Math.min(5, n)));
  const empty = "☆".repeat(Math.max(0, 5 - n));
  return full + empty;
}

export default async function AdminAvaliacoesPage() {
  const geral = await prisma.avaliacao.aggregate({
    _avg: { notaGeral: true },
    _count: { notaGeral: true },
  });

  const avg = geral._avg.notaGeral ?? null;
  const total = geral._count.notaGeral ?? 0;

  const distRaw = await prisma.avaliacao.groupBy({
    by: ["notaGeral"],
    _count: { notaGeral: true },
    orderBy: { notaGeral: "desc" },
  });

  const distMap = new Map<number, number>();
  for (const row of distRaw) {
    if (typeof row.notaGeral === "number") {
      distMap.set(row.notaGeral, row._count.notaGeral);
    }
  }
  const dist = [5, 4, 3, 2, 1].map((nota) => ({
    nota,
    count: distMap.get(nota) ?? 0,
    percent: pct(distMap.get(nota) ?? 0, total),
  }));
  const abaixo3 = (distMap.get(1) ?? 0) + (distMap.get(2) ?? 0);

  const topDiaristas = await prisma.avaliacao.groupBy({
    by: ["diaristaId"],
    _avg: { notaGeral: true },
    _count: { notaGeral: true },
    having: {
      notaGeral: {
        _count: { gt: 5 },
      },
    },
    orderBy: {
      _avg: { notaGeral: "desc" },
    },
    take: 10,
  });

  const diaristaIds = topDiaristas.map((d) => d.diaristaId).filter(Boolean) as string[];
  const diaristas = diaristaIds.length
    ? await prisma.user.findMany({
        where: { id: { in: diaristaIds } },
        select: { id: true, nome: true, telefone: true },
      })
    : [];
  const diaristaById = new Map(diaristas.map((u) => [u.id, u]));
  const top = topDiaristas.map((row) => {
    const u = row.diaristaId ? diaristaById.get(row.diaristaId) : null;
    return {
      diaristaId: row.diaristaId,
      nome: u?.nome ?? "Diarista",
      telefone: u?.telefone ?? "",
      media: row._avg.notaGeral ?? null,
      total: row._count.notaGeral,
    };
  });

  const ultimas = await prisma.avaliacao.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: 20,
    select: {
      id: true,
      notaGeral: true,
      comentario: true,
      diaristaId: true,
      clientId: true,
      servico: {
        select: {
          id: true,
          cidade: true,
          bairro: true,
          createdAt: true,
          data: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">Avaliações</h1>
          <p className="opacity-70">Fonte: Avaliacao.notaGeral</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-black/10 bg-white p-4">
          <div className="text-sm opacity-70">Nota média</div>
          <div className="mt-1 text-3xl font-extrabold">{fmt1(avg)}</div>
        </div>

        <div className="rounded-xl border border-black/10 bg-white p-4">
          <div className="text-sm opacity-70">Total de avaliações</div>
          <div className="mt-1 text-3xl font-extrabold">{total}</div>
        </div>

        <div className="rounded-xl border border-black/10 bg-white p-4">
          <div className="text-sm opacity-70">Abaixo de 3 estrelas</div>
          <div className="mt-1 text-3xl font-extrabold">{pct(abaixo3, total)}</div>
          <div className="mt-1 text-sm opacity-60">{abaixo3} avaliação(ões) com 1–2 estrelas</div>
        </div>
      </div>

      <div className="rounded-xl border border-black/10 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-bold">Distribuição (1–5)</div>
          <div className="text-sm opacity-60">percentual por nota</div>
        </div>

        <div className="space-y-2">
          {dist.map((r) => (
            <div key={r.nota} className="flex items-center gap-3">
              <div className="w-20 text-sm font-semibold">
                {r.nota} {r.nota === 1 ? "estrela" : "estrelas"}
              </div>

              <div className="flex-1">
                <div className="h-2 rounded-full bg-black/10">
                  <div
                    className="h-2 rounded-full bg-black/40"
                    style={{
                      width: total === 0 ? "0%" : `${Math.round((r.count / total) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="w-16 text-right text-sm opacity-70">{r.percent}</div>
              <div className="w-16 text-right text-sm font-semibold">{r.count}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-black/10 bg-white p-4">
        <div className="mb-3">
          <div className="text-lg font-bold">Top diaristas</div>
          <div className="text-sm opacity-60">mín. 6 avaliações</div>
        </div>

        {top.length === 0 ? (
          <div className="text-sm opacity-70">Ainda não há dados suficientes.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left opacity-70">
                <tr>
                  <th className="py-2 pr-3">Diarista</th>
                  <th className="py-2 pr-3">Média</th>
                  <th className="py-2 pr-3">Avaliações</th>
                  <th className="py-2 pr-3">Telefone</th>
                </tr>
              </thead>
              <tbody>
                {top.map((d) => (
                  <tr key={d.diaristaId ?? d.nome} className="border-t border-black/5">
                    <td className="py-2 pr-3 font-semibold">{d.nome}</td>
                    <td className="py-2 pr-3">
                      <span className="font-semibold">{fmt1(d.media)}</span>{" "}
                      <span className="opacity-60">
                        {d.media ? stars(Math.round(d.media)) : ""}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{d.total}</td>
                    <td className="py-2 pr-3 opacity-70">{d.telefone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-black/10 bg-white p-4">
        <div className="mb-3">
          <div className="text-lg font-bold">Últimas avaliações</div>
          <div className="text-sm opacity-60">feed dos últimos serviços avaliados</div>
        </div>

        {ultimas.length === 0 ? (
          <div className="text-sm opacity-70">Nenhuma avaliação encontrada.</div>
        ) : (
          <div className="space-y-3">
            {ultimas.map((s) => {
              const dt = s.servico?.data ?? s.servico?.createdAt ?? null;
              const when = dt
                ? new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(dt)
                : "—";
              return (
                <div key={s.id} className="rounded-lg border border-black/10 p-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-semibold">
                        {stars(s.notaGeral ?? 0)}{" "}
                        <span className="opacity-70">({s.notaGeral})</span>
                      </div>
                      <div className="text-sm opacity-70">
                        {s.servico?.cidade ?? "—"} • {s.servico?.bairro ?? "—"} • {when}
                      </div>
                    </div>
                    <div className="text-xs opacity-60">#{(s.servico?.id ?? s.id).slice(0, 8)}</div>
                  </div>

                  {s.comentario ? (
                    <div className="mt-2 text-sm">{s.comentario}</div>
                  ) : (
                    <div className="mt-2 text-sm opacity-60">Sem comentário.</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
