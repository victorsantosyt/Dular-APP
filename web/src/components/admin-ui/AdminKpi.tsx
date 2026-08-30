type Props = {
  label: string;
  value: string;
  hint?: string;
};

export function AdminKpi({ label, value, hint }: Props) {
  return (
    <div className="rounded-2xl border border-border bg-glass-surface-strong p-4 ring-1 ring-border">
      <div className="text-xs text-fg-subtle">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-fg">{value}</div>
      {hint ? <div className="mt-1 text-xs text-fg-subtle">{hint}</div> : null}
    </div>
  );
}
