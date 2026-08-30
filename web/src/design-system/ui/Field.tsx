import { cn } from "@/design-system/utils/cn";

/** Input de formulário com rótulo — mesma altura/raio do Button (md). */
export function Field({
  label,
  hint,
  className,
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const inputId = id ?? `field-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className="mb-1.5 block text-eyebrow font-bold uppercase text-fg-subtle"
      >
        {label}
      </label>
      <input
        id={inputId}
        className={cn(
          "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg",
          "placeholder:text-fg-disabled",
          "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
        {...props}
      />
      {hint ? <p className="mt-1.5 text-xs text-fg-subtle">{hint}</p> : null}
    </div>
  );
}
