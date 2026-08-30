import type { LucideIcon } from "lucide-react";
import { cn } from "@/design-system/utils/cn";
import type { Tone } from "@/design-system/ui";

/** Faixa lateral + cor do número, seguindo a escala de prioridade do painel. */
const BORDA: Record<Tone, string> = {
  critical: "border-l-error",
  high: "border-l-orange",
  medium: "border-l-warning",
  low: "border-l-info",
  success: "border-l-success",
  info: "border-l-info",
  neutral: "border-l-accent",
};

const VALOR: Record<Tone, string> = {
  critical: "text-error-dark",
  high: "text-orange-dark",
  medium: "text-warning-dark",
  low: "text-info-dark",
  success: "text-success-dark",
  info: "text-info-dark",
  neutral: "text-fg",
};

const ICONE: Record<Tone, string> = {
  critical: "text-error",
  high: "text-orange",
  medium: "text-warning",
  low: "text-info",
  success: "text-success",
  info: "text-info",
  neutral: "text-accent",
};

type Props = {
  label: string;
  value: string;
  hint?: string;
  /** Nível na escala de prioridade — pinta a faixa lateral e o número. */
  tone?: Tone;
  /** Ícone que identifica do que o cartão trata. */
  icon?: LucideIcon;
};

export function AdminKpi({ label, value, hint, tone = "neutral", icon: Icon }: Props) {
  return (
    <div className={cn("rounded-xl border border-l-4 border-border bg-surface p-5", BORDA[tone])}>
      <div className="flex items-center gap-2">
        {Icon ? <Icon size={15} strokeWidth={2} className={cn("shrink-0", ICONE[tone])} /> : null}
        <div className="text-eyebrow font-bold uppercase text-fg-subtle">{label}</div>
      </div>
      <div className={cn("mt-3 text-metric font-bold tabular-nums", VALOR[tone])}>{value}</div>
      {hint ? <div className="mt-1.5 text-xs leading-relaxed text-fg-subtle">{hint}</div> : null}
    </div>
  );
}
