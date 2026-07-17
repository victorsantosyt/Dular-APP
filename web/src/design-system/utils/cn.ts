/**
 * cn — Class Name utility
 *
 * Junta classes condicionalmente, filtrando valores falsy.
 * Sem dependência externa (evita clsx/tailwind-merge por ora).
 *
 * @example
 * cn("px-4 py-2", isActive && "bg-accent", disabled && "opacity-50")
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export default cn;
