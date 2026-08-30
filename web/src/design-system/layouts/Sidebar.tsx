"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/design-system/utils/cn";
import { NAV_SECTIONS, NAV_SETTINGS, type NavItem } from "./nav";
import type { HeaderUser } from "./Header";

function matches(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin" || pathname === "/admin/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * href ativo = o match MAIS ESPECÍFICO (mais longo) entre todos os itens.
 * Sem isso, /admin/insights/feedbacks acende "Analytics" (casa pelo prefixo)
 * E "Feedbacks" (casa exato) ao mesmo tempo.
 */
function resolveActiveHref(pathname: string, hrefs: string[]): string | null {
  let melhor: string | null = null;
  for (const href of hrefs) {
    if (!matches(pathname, href)) continue;
    if (melhor === null || href.length > melhor.length) melhor = href;
  }
  return melhor;
}

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  const { icon: Icon, label, soon } = item;

  const content = (
    <>
      {/* Barra de seleção: substitui o "bloco pintado" por um indicador
          discreto na borda — padrão de painel profissional. */}
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full transition-colors",
          active ? "bg-accent" : "bg-transparent",
        )}
      />
      <Icon size={18} className="shrink-0" strokeWidth={active ? 2.2 : 1.75} />
      <span className="truncate">{label}</span>
      {soon ? (
        <span className="ml-auto rounded-full bg-surface-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fg-disabled">
          Em breve
        </span>
      ) : null}
    </>
  );

  const base =
    "relative flex items-center gap-3 rounded-lg py-2 pl-4 pr-3 text-sm transition-colors duration-150";

  if (soon) {
    return (
      <div
        className={cn(base, "cursor-not-allowed font-medium text-fg-disabled")}
        aria-disabled="true"
        title="Em breve"
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        base,
        active
          ? "bg-accent-subtle font-semibold text-accent-strong"
          : "font-medium text-fg-muted hover:bg-surface-subtle hover:text-fg",
      )}
    >
      {content}
    </Link>
  );
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  EMPREGADOR: "Empregador",
  DIARISTA: "Diarista",
  MONTADOR: "Montador",
};

export default function Sidebar({ user }: { user?: HeaderUser | null }) {
  const pathname = usePathname() || "/admin";

  // Itens `soon` ficam de fora: não navegam, então nunca podem estar ativos.
  const todosHrefs = [
    ...NAV_SECTIONS.flatMap((s) => s.items.filter((i) => !i.soon).map((i) => i.href)),
    NAV_SETTINGS.href,
  ];
  const activeHref = resolveActiveHref(pathname, todosHrefs);

  return (
    <aside className="sticky top-0 flex h-screen w-[264px] shrink-0 flex-col border-r border-border bg-surface">
      {/* Identidade: logo + usuário logado (mesma altura do Header) */}
      <div className="flex h-16 items-center gap-3 border-b border-border-subtle px-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-accent-subtle ring-1 ring-border">
          <Image
            src="/brand/dular-mark.png"
            alt="Dular"
            width={28}
            height={28}
            className="h-7 w-7 object-contain"
            priority
          />
        </div>
        <div className="min-w-0">
          {user === undefined ? (
            <>
              <div className="h-3.5 w-24 animate-pulse rounded bg-surface-subtle" />
              <div className="mt-1.5 h-3 w-16 animate-pulse rounded bg-surface-subtle" />
            </>
          ) : (
            <>
              <div className="truncate text-sm font-semibold leading-tight text-fg">
                {user?.nome ?? "—"}
              </div>
              <div className="truncate text-xs leading-tight text-fg-subtle">
                {ROLE_LABEL[user?.role ?? ""] ?? user?.role ?? ""}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section, idx) => (
          <div key={section.label ?? `section-${idx}`} className={idx > 0 ? "mt-6" : ""}>
            {section.label ? (
              <div className="px-4 pb-2 text-eyebrow font-bold uppercase text-fg-disabled">
                {section.label}
              </div>
            ) : null}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavRow key={item.href} item={item} active={item.href === activeHref} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Rodapé: Configurações */}
      <div className="border-t border-border-subtle px-3 py-3">
        <NavRow item={NAV_SETTINGS} active={NAV_SETTINGS.href === activeHref} />
      </div>
    </aside>
  );
}
