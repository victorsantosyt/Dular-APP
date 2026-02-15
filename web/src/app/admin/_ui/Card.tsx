type Props = {
  title?: string;
  children: React.ReactNode;
  muted?: string;
  className?: string;
};

export default function Card({ title, children, muted, className }: Props) {
  return (
    <div className={["rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", className].join(" ")}>
      {title ? <div className="mb-2 text-sm font-semibold text-slate-800">{title}</div> : null}
      {muted ? <div className="mb-3 text-xs text-slate-500">{muted}</div> : null}
      {children}
    </div>
  );
}
