type Props = {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function AdminCard({ title, right, children, className = "" }: Props) {
  return (
    <section className={["rounded-xl border border-border bg-surface", className].join(" ")}>
      {(title || right) && (
        <div className="flex items-center justify-between gap-4 border-b border-border-subtle px-5 py-4">
          {title ? (
            <h2 className="text-sm font-semibold tracking-tight text-fg">{title}</h2>
          ) : (
            <div />
          )}
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
