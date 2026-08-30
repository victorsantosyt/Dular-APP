export function AdminEmpty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border-subtle bg-glass-surface p-4 text-fg-muted">
      <div className="font-semibold text-fg">{title}</div>
      {hint ? <div className="mt-1 text-sm text-fg-subtle">{hint}</div> : null}
    </div>
  );
}
