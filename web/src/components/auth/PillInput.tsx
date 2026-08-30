import { useId } from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & { label: string };

export default function PillInput({ label, id, ...props }: Props) {
  const gerado = useId();
  const inputId = id ?? gerado;

  return (
    <div className="space-y-1.5">
      {/* htmlFor/id: sem isso, clicar no rótulo não focava o campo. */}
      <label htmlFor={inputId} className="block text-xs font-medium text-fg-muted">
        {label}
      </label>
      <input
        id={inputId}
        {...props}
        className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-fg outline-none placeholder:text-fg-disabled focus:border-accent focus:ring-2 focus:ring-accent/25"
      />
    </div>
  );
}
