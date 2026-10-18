export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { Inbox, MessageCircle, TriangleAlert, CalendarClock } from "lucide-react";
import type { FeedbackTipo } from "@prisma/client";

import { AdminPage } from "@/components/admin-ui/AdminPage";
import { AdminGrid } from "@/components/admin-ui/AdminGrid";
import { AdminCard } from "@/components/admin-ui/AdminCard";
import { AdminKpi } from "@/components/admin-ui/AdminKpi";
import { AdminEmpty } from "@/components/admin-ui/AdminEmpty";
import { Badge } from "@/design-system/ui";
import type { Tone } from "@/design-system/ui";
import { cn } from "@/design-system/utils/cn";
import {
  ROTULO_DO_TIPO,
  indicadoresDeFeedback,
  listarFeedback,
} from "@/lib/adminFeedback";
import { requireAdminSession } from "@/lib/adminSession";

const TIPOS = ["SUGESTAO", "PROBLEMA", "ELOGIO", "OUTRO"] as const;

const TOM_DO_TIPO: Record<FeedbackTipo, Tone> = {
  PROBLEMA: "critical",
  SUGESTAO: "info",
  ELOGIO: "success",
  OUTRO: "neutral",
};

const ROTULO_DO_PAPEL: Record<string, string> = {
  EMPREGADOR: "Empregador",
  DIARISTA: "Profissional",
  MONTADOR: "Montador",
  ADMIN: "Administrador",
};

function quando(d: Date): string {
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Params = {
  searchParams: Promise<{ tipo?: string; pagina?: string }>;
};

export default async function SugestoesPage({ searchParams }: Params) {
  // Antes de qualquer leitura: ADMIN ativo no banco (o layout roda em paralelo).
  await requireAdminSession();
  const sp = await searchParams;
  const tipo = TIPOS.find((t) => t === sp.tipo);
  const pagina = Math.max(1, Number(sp.pagina ?? "1") || 1);

  const [indicadores, lista] = await Promise.all([
    indicadoresDeFeedback(),
    listarFeedback({ tipo, pagina }),
  ]);

  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { tipo: sp.tipo, ...extra };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/admin/insights/sugestoes?${s}` : "/admin/insights/sugestoes";
  };

  const chip = (ativo: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-xs font-bold",
      ativo
        ? "border-accent bg-accent-light text-accent-dark"
        : "border-border text-fg-muted",
    );

  return (
    <AdminPage title="" subtitle="">
      <AdminGrid>
        <div className="md:col-span-3">
          <AdminKpi
            label="Mensagens recebidas"
            value={String(indicadores.total)}
            hint="Desde o início"
            icon={MessageCircle}
            tone="neutral"
          />
        </div>
        <div className="md:col-span-3">
          <AdminKpi
            label="Ainda não lidas"
            value={String(indicadores.naoLidos)}
            hint="Aparecem primeiro na lista"
            icon={Inbox}
            tone={indicadores.naoLidos > 0 ? "high" : "success"}
          />
        </div>
        <div className="md:col-span-3">
          <AdminKpi
            label="Problemas relatados"
            value={String(indicadores.problemas)}
            hint="Quem disse que algo não funcionou"
            icon={TriangleAlert}
            tone={indicadores.problemas > 0 ? "critical" : "neutral"}
          />
        </div>
        <div className="md:col-span-3">
          <AdminKpi
            label="Últimos 7 dias"
            value={String(indicadores.ultimos7Dias)}
            hint="Mostra se a fila está crescendo"
            icon={CalendarClock}
            tone="info"
          />
        </div>
      </AdminGrid>

      {/*
        A margem é responsabilidade da página: `AdminPage` renderiza uma <div>
        sem classe e não há regra global entre irmãos.
      */}
      <AdminCard title="O que dizem do app" icon={MessageCircle} className="mt-4">
        <p className="mb-4 text-sm leading-6 text-fg-muted">
          Opinião sobre o <strong>aplicativo</strong>, escrita por quem o usa. Não
          confundir com a tela de Feedbacks, que mostra a nota dada a quem prestou
          o serviço — aqui ninguém está avaliando pessoa nenhuma.
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          <Link href={qs({ tipo: undefined, pagina: undefined })} className={chip(!tipo)}>
            Todas
          </Link>
          {TIPOS.map((t) => (
            <Link key={t} href={qs({ tipo: t, pagina: undefined })} className={chip(tipo === t)}>
              {ROTULO_DO_TIPO[t]}
            </Link>
          ))}
        </div>

        {lista.linhas.length === 0 ? (
          <AdminEmpty
            title="Nenhuma mensagem com esse filtro"
            hint="Quando alguém enviar feedback pelo app, aparece aqui."
          />
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {lista.linhas.map((f) => (
                <li
                  key={f.id}
                  className={cn(
                    "rounded-lg border bg-surface-secondary p-4",
                    f.lido ? "border-border" : "border-accent/40",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={TOM_DO_TIPO[f.tipo]}>{ROTULO_DO_TIPO[f.tipo]}</Badge>
                    {f.nota !== null ? (
                      <span
                        className="text-sm tabular-nums text-warning"
                        aria-label={`Nota ${f.nota} de 5`}
                      >
                        {"★".repeat(f.nota)}
                        <span className="text-border">{"★".repeat(5 - f.nota)}</span>
                      </span>
                    ) : null}
                    {!f.lido ? <Badge tone="info">nova</Badge> : null}
                    <span className="ml-auto text-xs text-fg-subtle">{quando(f.createdAt)}</span>
                  </div>

                  <p className="mt-2.5 whitespace-pre-wrap text-sm leading-6 text-fg">
                    {f.mensagem}
                  </p>

                  <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 border-t border-border-subtle pt-2.5 text-xs text-fg-subtle">
                    <span>
                      {f.autor.nome}
                      {f.autor.papel ? ` · ${ROTULO_DO_PAPEL[f.autor.papel] ?? f.autor.papel}` : ""}
                    </span>
                    {f.origem ? <span>tela: {f.origem}</span> : null}
                    {f.plataforma ? <span>{f.plataforma}</span> : null}
                    {f.appVersao ? <span>app {f.appVersao}</span> : null}
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex items-center justify-between text-sm text-fg-muted">
              <span>
                {lista.total} mensage{lista.total === 1 ? "m" : "ns"} · página{" "}
                {lista.pagina} de {lista.totalPaginas}
              </span>
              <span className="flex gap-2">
                {lista.pagina > 1 && (
                  <Link
                    href={qs({ pagina: String(lista.pagina - 1) })}
                    className="rounded-lg border border-border px-3 py-1 font-bold"
                  >
                    Anterior
                  </Link>
                )}
                {lista.pagina < lista.totalPaginas && (
                  <Link
                    href={qs({ pagina: String(lista.pagina + 1) })}
                    className="rounded-lg border border-border px-3 py-1 font-bold"
                  >
                    Próxima
                  </Link>
                )}
              </span>
            </div>
          </>
        )}
      </AdminCard>
    </AdminPage>
  );
}
