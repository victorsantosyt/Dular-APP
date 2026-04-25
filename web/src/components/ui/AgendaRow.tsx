import { Check, UserRound } from "lucide-react";

type AgendaRowProps = {
  name: string;
  subtitle: string;
  time: string;
};

export function AgendaRow({ name, subtitle, time }: AgendaRowProps) {
  return (
    <div className="flex items-center gap-2.5 border-b border-dular-stroke px-3.5 py-2.5 last:border-b-0 hover:bg-dular-green-light transition">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-dular-green-light text-dular-green">
        <UserRound size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-extrabold text-dular-ink">{name}</p>
        <p className="truncate text-[10px] font-medium text-dular-sub">{subtitle}</p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-dular-green-light px-2.5 py-1">
        <Check size={10} className="text-dular-green-dark" />
        <span className="text-[11px] font-extrabold text-dular-green-dark">{time}</span>
      </span>
    </div>
  );
}
