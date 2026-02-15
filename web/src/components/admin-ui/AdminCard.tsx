type Props = {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function AdminCard({ title, right, children, className = "" }: Props) {
  return (
    <section
      className={[
        "rounded-2xl border border-white/40 bg-white/70 shadow-sm backdrop-blur",
        "ring-1 ring-slate-900/5",
        className,
      ].join(" ")}
    >
      {(title || right) && (
        <div className="flex items-center justify-between px-5 pt-5">
          {title ? <h2 className="text-sm font-semibold text-slate-800">{title}</h2> : <div />}
          {right ? <div>{right}</div> : null}
        </div>
      )}
      <div className="px-5 pb-5 pt-4">{children}</div>
    </section>
  );
}
