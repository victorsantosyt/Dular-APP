import type { LucideIcon } from "lucide-react";
import { cn } from "@/design-system/utils/cn";

type Props = {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Ícone que identifica do que o cartão trata. */
  icon?: LucideIcon;
};

export function AdminCard({ title, right, children, className = "", icon: Icon }: Props) {
  return (
    <section className={cn("rounded-xl border border-border bg-surface", className)}>
      {(title || right) && (
        <div className="flex items-center justify-between gap-4 border-b border-border-subtle px-5 py-4">
          {title ? (
            <div className="flex min-w-0 items-center gap-2">
              {Icon ? (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent-strong">
                  <Icon size={15} strokeWidth={2} />
                </span>
              ) : null}
              <h2 className="truncate text-sm font-semibold tracking-tight text-fg">{title}</h2>
            </div>
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
