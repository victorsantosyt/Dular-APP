import { ChevronDown } from "lucide-react";
import { AgendaRow } from "@/components/ui/AgendaRow";

type AgendaItem = {
  id: string;
  name: string;
  subtitle: string;
  time: string;
};

type AgendaCardProps = {
  title: string;
  rows: AgendaItem[];
};

export function AgendaCard({ title, rows }: AgendaCardProps) {
  return (
    <section className="overflow-hidden rounded-16 bg-dular-card shadow-card">
      <header className="flex items-center justify-between border-b border-dular-stroke px-3.5 py-3">
        <h3 className="text-[13px] font-extrabold text-dular-ink">{title}</h3>
        <ChevronDown size={14} className="text-dular-sub" />
      </header>
      <div>
        {rows.map((row) => (
          <AgendaRow key={row.id} name={row.name} subtitle={row.subtitle} time={row.time} />
        ))}
      </div>
    </section>
  );
}
