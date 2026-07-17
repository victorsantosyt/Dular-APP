"use client";

import { useEffect, useState } from "react";
import { Search, Bell } from "lucide-react";
import { cn } from "@/design-system/utils/cn";

export type HeaderUser = {
  id: string;
  nome: string | null;
  avatarUrl: string | null;
  role: string;
};

function initials(name: string | null): string {
  if (!name) return "·";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "").concat(parts[1]?.[0] ?? "").toUpperCase() || "·";
}

/**
 * Header — barra superior do painel.
 * Contém: título da página, busca, notificações e avatar.
 * Breadcrumb é um slot separado no AdminLayout (não duplicar aqui).
 *
 * O usuário pode ser injetado via prop (`user`) — útil no catálogo — ou
 * auto-carregado de /api/me/header quando `autoLoadUser` estiver ativo.
 */
export default function Header({
  title,
  actions,
  user: userProp,
  autoLoadUser = false,
}: {
  title?: string;
  actions?: React.ReactNode;
  user?: HeaderUser | null;
  autoLoadUser?: boolean;
}) {
  const [user, setUser] = useState<HeaderUser | null>(userProp ?? null);

  useEffect(() => {
    if (userProp !== undefined) setUser(userProp);
  }, [userProp]);

  useEffect(() => {
    if (!autoLoadUser || userProp) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/me/header?t=${Date.now()}`, {
          headers: { "Cache-Control": "no-cache" },
        });
        if (!r.ok) return;
        const j = await r.json().catch(() => null);
        if (alive && j?.ok) setUser(j.user ?? null);
      } catch {
        /* silencioso */
      }
    })();
    return () => {
      alive = false;
    };
  }, [autoLoadUser, userProp]);

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-4 border-b border-border bg-surface/95 px-6 backdrop-blur-sm">
      <div className="min-w-0 flex-1">
        {title ? (
          <h1 className="truncate text-xl font-semibold tracking-tight text-fg">{title}</h1>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {actions}

        <button
          type="button"
          aria-label="Buscar"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-secondary hover:text-fg"
        >
          <Search size={18} />
        </button>

        <button
          type="button"
          aria-label="Notificações"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-secondary hover:text-fg"
        >
          <Bell size={18} />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent" />
        </button>

        <div className="ml-1 flex items-center gap-2">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center overflow-hidden rounded-full",
              "bg-accent-subtle text-xs font-semibold text-accent ring-1 ring-border",
            )}
          >
            {user?.avatarUrl ? (
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
        </div>
      </div>
    </header>
  );
}
