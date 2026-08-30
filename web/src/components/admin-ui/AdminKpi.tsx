type Props = {
  label: string;
  value: string;
  hint?: string;
};

export function AdminKpi({ label, value, hint }: Props) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="text-eyebrow font-bold uppercase text-fg-subtle">{label}</div>
      <div className="mt-3 text-metric font-bold tabular-nums text-fg">{value}</div>
      {hint ? <div className="mt-1.5 text-xs leading-relaxed text-fg-subtle">{hint}</div> : null}
    </div>
  );
}
