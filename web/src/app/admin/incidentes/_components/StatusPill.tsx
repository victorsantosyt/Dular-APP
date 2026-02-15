export function StatusPill({ status }: { status: string }) {
  const s = (status || "").toUpperCase();
  const map: Record<string, string> = {
    ABERTO: "bg-amber-100 text-amber-900 border-amber-200",
    EM_ANALISE: "bg-blue-100 text-blue-900 border-blue-200",
    CONFIRMADO: "bg-red-100 text-red-900 border-red-200",
    ENCERRADO: "bg-emerald-100 text-emerald-900 border-emerald-200",
  };
  const cls = map[s] ?? "bg-gray-100 text-gray-800 border-gray-200";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}
    >
      {s || "—"}
    </span>
  );
}
