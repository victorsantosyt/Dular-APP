import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/design-system/utils/cn";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

/**
 * Breadcrumb — trilha de navegação.
 * O último item é sempre o atual (sem link, destacado).
 */
export default function Breadcrumb({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  if (!items.length) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1.5 text-sm", className)}>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <span key={`${item.label}-${idx}`} className="flex items-center gap-1.5">
            {idx > 0 ? <ChevronRight size={14} className="text-fg-disabled" /> : null}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="text-fg-muted transition-colors hover:text-fg"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "font-medium text-fg" : "text-fg-muted"}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
