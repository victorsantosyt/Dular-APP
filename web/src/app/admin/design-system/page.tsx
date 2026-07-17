export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { colors, spacing, radius, shadows } from "@/design-system/foundations";

/**
 * Catálogo do Design System (documentação viva).
 *
 * NOTA: esta é a única página onde Tailwind "cru" é aceitável — ela DOCUMENTA
 * os tokens. Todas as demais páginas devem montar componentes de ui/patterns.
 *
 * Estrutura preparada para crescer: à medida que os componentes das camadas
 * ui/ e patterns/ forem criados (Fase 2), suas seções substituem os
 * placeholders "Em breve" abaixo.
 */
export default function DesignSystemCatalogPage() {
  return (
    <div className="space-y-10">
      <Intro />
      <ColorsSection />
      <TypographySection />
      <SpacingSection />
      <RadiusSection />
      <ShadowSection />
      <ComponentsPlaceholder />
    </div>
  );
}

/* ─────────────────────────────── Blocos ─────────────────────────────── */

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-tight text-fg">{title}</h2>
        {description ? <p className="mt-1 text-sm text-fg-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Intro() {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <span className="inline-flex items-center rounded-full bg-accent-subtle px-3 py-1 text-xs font-semibold text-accent">
        Fase 2 · em construção
      </span>
      <h1 className="mt-3 text-display font-bold tracking-tight text-fg">Design System · Dular Admin</h1>
      <p className="mt-2 max-w-2xl text-sm text-fg-muted">
        Documentação viva dos tokens e componentes do painel. Arquitetura em 4 camadas:
        <span className="font-medium text-fg"> foundations → ui → patterns → layouts</span>. Esta
        página é o ambiente onde cada componente é validado antes de entrar nas telas reais.
      </p>
    </div>
  );
}

function ColorsSection() {
  const semanticSwatches: { name: string; className: string; text: string }[] = [
    { name: "surface", className: "bg-surface border border-border", text: "text-fg" },
    { name: "surface-secondary", className: "bg-surface-secondary", text: "text-fg" },
    { name: "surface-subtle", className: "bg-surface-subtle", text: "text-fg" },
    { name: "accent", className: "bg-accent", text: "text-white" },
    { name: "accent-hover", className: "bg-accent-hover", text: "text-white" },
    { name: "accent-subtle", className: "bg-accent-subtle", text: "text-accent" },
    { name: "success", className: "bg-success", text: "text-white" },
    { name: "warning", className: "bg-warning", text: "text-white" },
    { name: "error", className: "bg-error", text: "text-white" },
    { name: "info", className: "bg-info", text: "text-white" },
  ];

  return (
    <Section
      title="Cores"
      description="Sempre use tokens semânticos (accent, surface, fg…). A escala bruta lavanda existe só como base."
    >
      {/* Tokens semânticos */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {semanticSwatches.map((s) => (
          <div key={s.name} className="overflow-hidden rounded-lg border border-border">
            <div className={`flex h-16 items-end p-2 ${s.className}`}>
              <span className={`text-xs font-medium ${s.text}`}>{s.name}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Escala bruta lavanda */}
      <div className="mt-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
          Escala primária (lavanda)
        </div>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
          {Object.entries(colors.primary).map(([shade, hex]) => (
            <div key={shade} className="text-center">
              <div
                className="h-12 w-full rounded-lg border border-border"
                style={{ backgroundColor: hex as string }}
              />
              <div className="mt-1 text-[11px] font-medium text-fg">{shade}</div>
              <div className="text-[10px] text-fg-subtle">{hex as string}</div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function TypographySection() {
  const scale = [
    { label: "Display · 32", className: "text-display font-bold" },
    { label: "H1 · 24", className: "text-2xl font-bold" },
    { label: "H2 · 20", className: "text-xl font-semibold" },
    { label: "H3 · 16", className: "text-base font-semibold" },
    { label: "Body · 14", className: "text-sm font-normal" },
    { label: "Caption · 12", className: "text-xs font-medium text-fg-muted" },
  ];

  return (
    <Section title="Tipografia" description="Escala tipográfica alinhada aos defaults do Tailwind.">
      <div className="space-y-4">
        {scale.map((t) => (
          <div key={t.label} className="flex items-baseline gap-4 border-b border-border-subtle pb-3">
            <span className="w-28 shrink-0 text-xs text-fg-subtle">{t.label}</span>
            <span className={`${t.className} text-fg`}>Dular painel administrativo</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function SpacingSection() {
  return (
    <Section title="Espaçamento" description="Escala base 8px — igual aos utilitários numéricos do Tailwind (p-1…p-16).">
      <div className="space-y-2">
        {Object.entries(spacing).map(([name, value]) => (
          <div key={name} className="flex items-center gap-4">
            <span className="w-12 text-xs font-medium text-fg">{name}</span>
            <div className="h-4 rounded bg-accent" style={{ width: value as string }} />
            <span className="text-xs text-fg-subtle">{value as string}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function RadiusSection() {
  const map: { name: string; className: string; token: string }[] = [
    { name: "lg", className: "rounded-lg", token: radius.sm },
    { name: "xl", className: "rounded-xl", token: radius.md },
    { name: "2xl", className: "rounded-2xl", token: radius.lg },
    { name: "3xl", className: "rounded-3xl", token: radius.xl },
    { name: "full", className: "rounded-full", token: radius.full },
  ];
  return (
    <Section title="Raio de borda" description="input/botão=lg · card=xl · modal=2xl.">
      <div className="flex flex-wrap gap-4">
        {map.map((r) => (
          <div key={r.name} className="text-center">
            <div className={`h-20 w-20 border border-border bg-accent-subtle ${r.className}`} />
            <div className="mt-2 text-xs font-medium text-fg">{r.className}</div>
            <div className="text-[10px] text-fg-subtle">{r.token}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function ShadowSection() {
  const map: { name: string; className: string }[] = [
    { name: "shadow-sm", className: "shadow-sm" },
    { name: "shadow-md", className: "shadow-md" },
    { name: "shadow-lg", className: "shadow-lg" },
  ];
  return (
    <Section title="Sombras" description="Três hierarquias: sutil (card), média (hover), grande (modal).">
      <div className="flex flex-wrap gap-6">
        {map.map((s) => (
          <div key={s.name} className="text-center">
            <div className={`flex h-20 w-32 items-center justify-center rounded-xl bg-surface ${s.className}`}>
              <span className="text-xs text-fg-muted">{s.name}</span>
            </div>
          </div>
        ))}
      </div>
      {/* Referência dos valores (foundations/shadows.ts) */}
      <div className="mt-4 grid gap-1 text-[10px] text-fg-subtle">
        <span>sm: {shadows.sm}</span>
        <span>md: {shadows.md}</span>
        <span>lg: {shadows.lg}</span>
      </div>
    </Section>
  );
}

function ComponentsPlaceholder() {
  const upcoming = [
    "Button", "Input", "Card", "Badge", "Modal", "Tabs", "Avatar", "Tooltip",
    "Dropdown", "DataTable", "FilterBar", "PageHeader", "StatCard", "EmptyState",
    "ConfirmDialog", "Skeleton", "Alert", "Toast",
  ];
  return (
    <Section
      title="Componentes"
      description="Serão desenvolvidos e validados aqui, nesta ordem, durante a Fase 2."
    >
      <div className="flex flex-wrap gap-2">
        {upcoming.map((c) => (
          <span
            key={c}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-fg-subtle"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-fg-disabled" />
            {c}
          </span>
        ))}
      </div>
    </Section>
  );
}
