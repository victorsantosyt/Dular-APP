import { Star, UserRound } from "lucide-react";

type ServiceCardProps = {
  name: string;
  subtitle: string;
  rating: number;
  actionLabel?: string;
  onAction?: () => void;
};

export function ServiceCard({
  name,
  subtitle,
  rating,
  actionLabel = "Solicitar",
  onAction,
}: ServiceCardProps) {
  return (
    <article className="flex items-center gap-3 rounded-16 bg-dular-card p-[13px] shadow-card transition hover:-translate-y-0.5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-dular-green text-white">
        <UserRound size={20} />
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[13px] font-extrabold text-dular-ink">{name}</h3>
        <p className="truncate text-[11px] font-medium text-dular-sub">{subtitle}</p>
        <div className="mt-1 flex items-center gap-1">
          <Star size={12} className="fill-dular-star text-dular-star" />
          <span className="text-[12px] font-bold text-dular-star">{rating.toFixed(1)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onAction}
        className="rounded-full bg-dular-green px-4 py-2 text-[12px] font-extrabold text-white shadow-[0_4px_14px_rgba(61,200,122,0.32)] transition hover:-translate-y-0.5 active:scale-[0.96]"
      >
        {actionLabel}
      </button>
    </article>
  );
}
