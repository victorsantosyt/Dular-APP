import type { ReactNode } from "react";

type ChipCategoryProps = {
  label: string;
  icon: ReactNode;
  active?: boolean;
  onClick?: () => void;
};

export function ChipCategory({ label, icon, active = false, onClick }: ChipCategoryProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group flex h-[80px] w-[82px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-16 border-2",
        "bg-dular-card px-1 py-2 text-center shadow-card transition",
        active ? "border-dular-green" : "border-transparent",
        "hover:-translate-y-0.5 active:scale-[0.96]",
      ]
        .join(" ")
        .trim()}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-dular-green-light text-[20px]">
        {icon}
      </span>
      <span className="text-[10px] font-bold leading-tight text-dular-ink">{label}</span>
    </button>
  );
}
