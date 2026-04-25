import { Clock3, Star } from "lucide-react";

type PendingCardProps = {
  pendingCount: number;
  title: string;
  duration: string;
  score: string;
  onAccept?: () => void;
};

export function PendingCard({ pendingCount, title, duration, score, onAccept }: PendingCardProps) {
  return (
    <section className="rounded-16 bg-gradient-to-br from-[#2F8E7E] to-[#1D6A5E] p-4 shadow-float">
      <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-white" />
        <span className="text-[11px] font-bold text-white">{pendingCount} Pendente(s)</span>
      </div>

      <h3 className="mb-2.5 text-[15px] font-extrabold text-white">{title}</h3>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/16 px-2.5 py-1 text-[10px] font-bold text-white/90">
            <Clock3 size={11} />
            {duration}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/16 px-2.5 py-1 text-[10px] font-bold text-white/90">
            <Star size={11} className="fill-white/90" />
            {score}
          </span>
        </div>

        <button
          type="button"
          onClick={onAccept}
          className="rounded-full bg-white px-4 py-2 text-[12px] font-extrabold text-dular-green-dark shadow-[0_2px_8px_rgba(0,0,0,0.12)] transition hover:-translate-y-0.5 active:scale-[0.96]"
        >
          Aceitar
        </button>
      </div>
    </section>
  );
}
