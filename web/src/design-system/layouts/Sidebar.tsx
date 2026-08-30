"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/design-system/utils/cn";
import { initials } from "@/design-system/utils/avatar";
import { NAV_SECTIONS, NAV_SETTINGS, type NavItem } from "./nav";
import type { HeaderUser } from "./Header";

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin" || pathname === "/admin/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  const { icon: Icon, label, soon } = item;

  const content = (
    <>
      <Icon size={18} className="shrink-0" />
      <span className="truncate">{label}</span>
      {soon ? (
        <span className="ml-auto rounded-full bg-surface-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
          Em breve
        </span>
      ) : null}
    </>
  );

  const base =
    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150";

  if (soon) {
    return (
      <div
        className={cn(base, "cursor-not-allowed text-fg-disabled")}
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
          ? "bg-accent-subtle text-accent"
          : "text-fg-muted hover:bg-surface-secondary hover:text-fg",
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

function UserBlock({ user }: { user?: HeaderUser | null }) {
  return (
    <div className="border-b border-glass-border px-3 py-3">
      <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-subtle text-xs font-semibold text-accent ring-1 ring-border">
          {user === undefined ? (
            <span className="h-full w-full animate-pulse bg-surface-subtle" />
          ) : user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt={user.nome ?? "Avatar"}
              className="h-full w-full object-cover"
            />
          ) : (
            <span>{initials(user?.nome ?? null)}</span>
          )}
        </div>
        <div className="min-w-0">
          {user === undefined ? (
            <>
              <div className="h-3.5 w-24 animate-pulse rounded bg-surface-subtle" />
              <div className="mt-1.5 h-3 w-16 animate-pulse rounded bg-surface-subtle" />
            </>
          ) : (
            <>
              <div className="truncate text-sm font-medium text-fg">{user?.nome ?? "—"}</div>
              <div className="truncate text-xs text-fg-subtle">
                {ROLE_LABEL[user?.role ?? ""] ?? user?.role ?? ""}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ user }: { user?: HeaderUser | null }) {
  const pathname = usePathname() || "/admin";

  return (
    <aside className="sticky top-0 flex h-screen w-[264px] shrink-0 flex-col border-r border-glass-border bg-glass-surface backdrop-blur-md">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-5">
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-surface-secondary ring-1 ring-border">
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
          <div className="truncate text-sm font-semibold text-fg">Dular</div>
          <div className="truncate text-xs text-fg-subtle">Painel administrativo</div>
        </div>
      </div>

      {/* Usuário logado */}
      <UserBlock user={user} />

      {/* Busca */}
      <div className="px-3 pb-2">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface-secondary px-3 py-2 text-sm text-fg-subtle transition-colors hover:border-fg-disabled"
        >
          <Search size={16} />
          <span>Buscar…</span>
          <kbd className="ml-auto rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-fg-subtle">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {NAV_SECTIONS.map((section, idx) => (
          <div key={section.label ?? `section-${idx}`} className={idx > 0 ? "mt-4" : ""}>
            {section.label ? (
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                {section.label}
              </div>
            ) : null}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavRow key={item.href} item={item} active={isActive(pathname, item.href)} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Rodapé: Configurações */}
      <div className="border-t border-border px-3 py-3">
        <NavRow item={NAV_SETTINGS} active={isActive(pathname, NAV_SETTINGS.href)} />
      </div>
    </aside>
  );
}
