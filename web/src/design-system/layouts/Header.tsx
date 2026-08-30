"use client";

import { useEffect, useState } from "react";
import { cn } from "@/design-system/utils/cn";
import { initials } from "@/design-system/utils/avatar";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { ROUTE_TITLES } from "./nav";
import NotificationsBell from "./NotificationsBell";

export type HeaderUser = {
  id: string;
  nome: string | null;
  avatarUrl: string | null;
  role: string;
};

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
  onOpenMenu,
}: {
  title?: string;
  actions?: React.ReactNode;
  user?: HeaderUser | null;
  autoLoadUser?: boolean;
  /** Abre a gaveta de navegação no mobile. */
  onOpenMenu?: () => void;
}) {
  const [user, setUser] = useState<HeaderUser | null>(userProp ?? null);
  const pathname = usePathname() || "";

  // Sem `title` explícito, deriva da rota: o mapa ROUTE_TITLES já existia mas
  // nenhum layout passava título, então a barra superior ficava vazia em TODAS
  // as telas. Casa o prefixo mais longo para cobrir sub-rotas (ex.: detalhe de
  // serviço herda "Serviços").
  const tituloDaRota = (() => {
    if (title) return title;
    let melhor = "";
    for (const rota of Object.keys(ROUTE_TITLES)) {
      const casa = pathname === rota || pathname.startsWith(`${rota}/`);
      if (casa && rota.length > melhor.length) melhor = rota;
    }
    return melhor ? ROUTE_TITLES[melhor] : undefined;
  })();

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
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 md:gap-4 md:px-8">
      {onOpenMenu ? (
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Abrir menu"
          className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-subtle hover:text-fg md:hidden"
        >
          <Menu size={20} strokeWidth={1.75} />
        </button>
      ) : null}
      <div className="min-w-0 flex-1">
        {tituloDaRota ? (
          <h1 className="truncate text-heading font-semibold text-fg">{tituloDaRota}</h1>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {actions}

        <NotificationsBell />

        <div className="ml-2 flex items-center gap-2 border-l border-border pl-3">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center overflow-hidden rounded-full",
              "bg-accent text-xs font-bold text-white",
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
