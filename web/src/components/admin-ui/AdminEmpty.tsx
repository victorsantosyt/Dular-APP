export function AdminEmpty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface-secondary px-4 py-6 text-center">
      <div className="text-sm font-semibold text-fg-muted">{title}</div>
      {hint ? <div className="mt-1 text-xs leading-relaxed text-fg-subtle">{hint}</div> : null}
    </div>
  );
}
