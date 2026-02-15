import Card from "./Card";

type Props = {
  icon: React.ReactNode;
  title: string;
  value: string;
  hint?: string;
  delta?: string;
  footer?: React.ReactNode;
};

export default function KpiCard({ icon, title, value, hint, delta, footer }: Props) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-200/35 ring-1 ring-white/40">
            {icon}
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-800">{title}</div>
            {hint ? <div className="text-xs text-slate-500">{hint}</div> : null}
          </div>
        </div>

        {delta ? <div className="text-xs font-semibold text-emerald-700">{delta}</div> : null}
      </div>

      <div className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{value}</div>

      {footer ? <div className="mt-2">{footer}</div> : null}
    </Card>
  );
}
