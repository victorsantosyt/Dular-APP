import Link from "next/link";
import { StatusPill } from "./StatusPill";

type Item = {
  id: string;
  status: string;
  type: string;
  severity: string;
  createdAt: string;
  description?: string | null;
  reportedUser?: { nome?: string | null; telefone?: string | null } | null;
  reportedBy?: { nome?: string | null; telefone?: string | null } | null;
};

export function IncidentCard({ item }: { item: Item }) {
  return (
    <Link
      href={`/admin/incidentes/${item.id}`}
      className="block rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-bold text-gray-900">
              {item.type} • {item.severity}
            </h3>
            <StatusPill status={item.status} />
          </div>

          <p className="mt-1 line-clamp-2 text-sm text-gray-600">
            {item.description || "Sem descrição."}
          </p>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            <span>ID: {item.id.slice(0, 8)}…</span>
            <span>Criado: {new Date(item.createdAt).toLocaleString("pt-BR")}</span>
            {(item.reportedUser?.nome || item.reportedUser?.telefone) && (
              <span>Denunciado: {item.reportedUser?.nome || item.reportedUser?.telefone}</span>
            )}
            {(item.reportedBy?.nome || item.reportedBy?.telefone) && (
              <span>Por: {item.reportedBy?.nome || item.reportedBy?.telefone}</span>
            )}
          </div>
        </div>

        <span className="text-gray-300">›</span>
      </div>
    </Link>
  );
}
