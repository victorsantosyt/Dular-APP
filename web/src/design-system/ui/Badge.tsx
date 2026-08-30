import { cn } from "@/design-system/utils/cn";

export type Tone = "critical" | "high" | "medium" | "low" | "success" | "info" | "neutral";

const TONES: Record<Tone, string> = {
  critical: "bg-error-light text-error-dark border-error/30",
  high: "bg-orange-light text-orange-dark border-orange/30",
  medium: "bg-warning-light text-warning-dark border-warning/30",
  low: "bg-info-light text-info-dark border-info/30",
  success: "bg-success-light text-success-dark border-success/30",
  info: "bg-info-light text-info-dark border-info/30",
  neutral: "bg-surface-subtle text-fg-muted border-border",
};

/**
 * Badge de estado/prioridade. Sempre acompanhado de texto — a cor reforça
 * a leitura, nunca é o único portador da informação (daltonismo).
 */
export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5",
        "text-[11px] font-bold uppercase tracking-wide",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Ponto colorido para uso dentro de linhas de tabela, onde um badge cheio
 * competiria com o texto. Acompanha sempre o rótulo ao lado.
 */
export function ToneDot({ tone = "neutral" }: { tone?: Tone }) {
  const DOT: Record<Tone, string> = {
    critical: "bg-error",
    high: "bg-orange",
    medium: "bg-warning",
    low: "bg-info",
    success: "bg-success",
    info: "bg-info",
    neutral: "bg-fg-disabled",
  };
  return <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", DOT[tone])} />;
}
