"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
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

function NavRow({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const { icon: Icon, label, soon, iconColor } = item;

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
      {/* Ícone mantém a cor de identidade do item; `soon` fica apagado. */}
      <Icon
        size={18}
        className={cn("shrink-0", soon ? "text-fg-disabled" : iconColor)}
        strokeWidth={active ? 2.2 : 1.75}
      />
      {!collapsed ? (
        <>
          <span className="truncate">{label}</span>
          {soon ? (
            <span className="ml-auto rounded-full bg-surface-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fg-disabled">
              Em breve
            </span>
          ) : null}
        </>
      ) : null}
    </>
  );

  const base = cn(
    "relative flex items-center rounded-lg py-2 text-sm transition-colors duration-150",
    // Recolhida: ícone centralizado, sem rótulo. O `title` vira o tooltip.
    collapsed ? "justify-center px-0" : "gap-3 pl-4 pr-3",
  );

  if (soon) {
    return (
      <div
        className={cn(base, "cursor-not-allowed font-medium text-fg-disabled")}
        aria-disabled="true"
        title={collapsed ? `${label} — em breve` : "Em breve"}
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
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

const STORAGE_KEY = "dular_admin_sidebar_collapsed";

export default function Sidebar({ user }: { user?: HeaderUser | null }) {
  const pathname = usePathname() || "/admin";
  const [collapsed, setCollapsed] = useState(false);

  // A preferência é lida depois da hidratação: ler no primeiro render
  // divergiria do HTML do servidor. O estado sobrevive à navegação client-side
  // (o componente não remonta); só um reload completo relê do storage.
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* storage indisponível — segue expandida */
    }
  }, []);

  function alternar() {
    setCollapsed((atual) => {
      const proximo = !atual;
      try {
        localStorage.setItem(STORAGE_KEY, proximo ? "1" : "0");
      } catch {
        /* não bloqueia a interação */
      }
      return proximo;
    });
  }

  // Itens `soon` ficam de fora: não navegam, então nunca podem estar ativos.
  const todosHrefs = [
    ...NAV_SECTIONS.flatMap((s) => s.items.filter((i) => !i.soon).map((i) => i.href)),
    NAV_SETTINGS.href,
  ];
  const activeHref = resolveActiveHref(pathname, todosHrefs);

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col border-r border-border bg-surface",
        "transition-[width] duration-200 ease-out",
        collapsed ? "w-[76px]" : "w-[264px]",
      )}
    >
      {/* Identidade: logo + usuário logado (mesma altura do Header) */}
      <div
        className={cn(
          "flex h-16 items-center border-b border-border-subtle",
          collapsed ? "justify-center px-0" : "gap-3 px-5",
        )}
      >
        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg">
          <Image
            src="/brand/dular-mark.png"
            alt="Dular"
            width={72}
            height={72}
            className="h-full w-full object-cover"
            priority
          />
        </div>
        {!collapsed ? (
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
        ) : null}
      </div>

      {/* Navegação */}
      <nav className={cn("flex-1 overflow-y-auto py-4", collapsed ? "px-3" : "px-3")}>
        {NAV_SECTIONS.map((section, idx) => (
          <div key={section.label ?? `section-${idx}`} className={idx > 0 ? "mt-6" : ""}>
            {section.label ? (
              collapsed ? (
                // Recolhida: o rótulo da seção vira um separador — some o texto
                // mas a divisão entre grupos continua legível.
                <div aria-hidden className="mx-auto mb-2 h-px w-6 bg-border" />
              ) : (
                <div className="px-4 pb-2 text-eyebrow font-bold uppercase text-fg-disabled">
                  {section.label}
                </div>
              )
            ) : null}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavRow
                  key={item.href}
                  item={item}
                  active={item.href === activeHref}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Rodapé: Configurações + alternar recolhimento */}
      <div className="border-t border-border-subtle px-3 py-3">
        <NavRow
          item={NAV_SETTINGS}
          active={NAV_SETTINGS.href === activeHref}
          collapsed={collapsed}
        />
        <button
          type="button"
          onClick={alternar}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          aria-expanded={!collapsed}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          className={cn(
            "mt-1 flex w-full items-center rounded-lg py-2 text-sm font-medium",
            "text-fg-subtle transition-colors hover:bg-surface-subtle hover:text-fg",
            collapsed ? "justify-center px-0" : "gap-3 pl-4 pr-3",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} strokeWidth={1.75} className="shrink-0" />
          ) : (
            <>
              <PanelLeftClose size={18} strokeWidth={1.75} className="shrink-0" />
              <span className="truncate">Recolher menu</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
