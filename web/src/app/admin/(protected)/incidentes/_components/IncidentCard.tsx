import Link from "next/link";
import { StatusPill } from "./StatusPill";
import { Badge, gravidadeTone, rotuloEnum } from "@/design-system/ui";

type Item = {
  id: string;
  status: string;
  type: string;
  severity: string;
  categoria?: string | null;
  gravidade?: string | null;
  createdAt: string;
  description?: string | null;
  anonimo?: boolean;
  reportedUser?: { nome?: string | null; telefone?: string | null } | null;
  reportedBy?: { nome?: string | null; telefone?: string | null } | null;
};

export function IncidentCard({ item }: { item: Item }) {
  // `gravidade` (4 níveis, inclui CRITICA) tem precedência sobre `severity`
  // (3 níveis, legado) — ambos existem no schema.
  const nivel = item.gravidade ?? item.severity;
  const tone = gravidadeTone(nivel);

  // Faixa lateral na cor da prioridade: dá leitura imediata numa lista longa,
  // sem depender de ler o badge de cada card.
  const FAIXA: Record<string, string> = {
    critical: "border-l-error",
    high: "border-l-orange",
    medium: "border-l-warning",
    low: "border-l-info",
    neutral: "border-l-border",
    success: "border-l-success",
    info: "border-l-info",
  };

  return (
    <Link
      href={`/admin/incidentes/${item.id}`}
      className={`block rounded-xl border border-l-4 border-border bg-surface p-4 transition-colors hover:bg-surface-subtle ${FAIXA[tone]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={tone}>{rotuloEnum(nivel)}</Badge>
            <StatusPill status={item.status} />
          </div>

          <h3 className="mt-2 truncate text-sm font-bold text-fg">
            {rotuloEnum(item.categoria ?? item.type)}
          </h3>

          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-fg-muted">
            {item.description || "Sem descrição."}
          </p>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-fg-subtle">
            <span>ID {item.id.slice(0, 8)}…</span>
            <span>{new Date(item.createdAt).toLocaleString("pt-BR")}</span>
            {item.reportedUser?.nome || item.reportedUser?.telefone ? (
              <span>Denunciado: {item.reportedUser?.nome || item.reportedUser?.telefone}</span>
            ) : null}
            {item.anonimo ? (
              <span>Por: anônimo</span>
            ) : item.reportedBy?.nome || item.reportedBy?.telefone ? (
              <span>Por: {item.reportedBy?.nome || item.reportedBy?.telefone}</span>
            ) : null}
          </div>
        </div>

        <span aria-hidden className="text-fg-disabled">
          ›
        </span>
      </div>
    </Link>
  );
}
