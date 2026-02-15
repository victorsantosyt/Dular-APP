type Props = {
  label: string;
  value: string;
  hint?: string;
};

export function AdminKpi({ label, value, hint }: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 ring-1 ring-slate-900/5">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-400">{hint}</div> : null}
    </div>
  );
}
