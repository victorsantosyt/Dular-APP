import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
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
  neutral: "border-l-fg-disabled",
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
  neutral: "text-fg-subtle",
};

type Props = {
  label: string;
  value: string;
  hint?: string;
  /** Nível na escala de prioridade — pinta a faixa lateral e o número. */
  tone?: Tone;
  /** Ícone que identifica do que o cartão trata. */
  icon?: LucideIcon;
  /**
   * Cor de IDENTIDADE (hex), para cartões que representam quem a pessoa é —
   * papel ou nicho — e não o quanto algo é urgente. Quando presente, substitui
   * a faixa da escala de prioridade.
   *
   * Vai por estilo inline de propósito: o Tailwind v4 varre o código em busca
   * de classes literais, então uma classe montada em runtime a partir do hex
   * simplesmente não seria gerada.
   */
  identidade?: string;
  /** Torna o cartão navegável, com afordância de clique. */
  href?: string;
};

export function AdminKpi({
  label,
  value,
  hint,
  tone = "neutral",
  icon: Icon,
  identidade,
  href,
}: Props) {
  const cartao = (
    <div
      className={cn(
        "h-full rounded-xl border border-l-4 border-border bg-surface p-5",
        identidade ? undefined : BORDA[tone],
        href && "transition-shadow hover:shadow-sm",
      )}
      style={identidade ? { borderLeftColor: identidade } : undefined}
    >
      <div className="flex items-center gap-2">
        {Icon ? (
          <Icon
            size={15}
            strokeWidth={2}
            className={cn("shrink-0", identidade ? undefined : ICONE[tone])}
            style={identidade ? { color: identidade } : undefined}
          />
        ) : null}
        <div className="text-eyebrow font-bold uppercase text-fg-subtle">{label}</div>
        {href ? (
          <ChevronRight size={15} strokeWidth={2} className="ml-auto shrink-0 text-fg-subtle" />
        ) : null}
      </div>
      <div
        className={cn(
          "mt-3 text-metric font-bold tabular-nums",
          identidade ? undefined : VALOR[tone],
        )}
        style={identidade ? { color: identidade } : undefined}
      >
        {value}
      </div>
      {hint ? <div className="mt-1.5 text-xs leading-relaxed text-fg-subtle">{hint}</div> : null}
    </div>
  );

  if (!href) return cartao;

  return (
    <Link
      href={href}
      className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      {cartao}
    </Link>
  );
}
