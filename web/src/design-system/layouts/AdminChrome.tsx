"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Header, { type HeaderUser } from "./Header";
import Breadcrumb, { type BreadcrumbItem } from "./Breadcrumb";
import { useSessaoExpira } from "./useSessaoExpira";

/**
 * Casca client do painel: guarda o estado da gaveta no mobile, que precisa ser
 * compartilhado entre o botão do Header e a Sidebar (componentes irmãos).
 * O AdminLayout continua sendo Server Component e só repassa os dados.
 */
export default function AdminChrome({
  title,
  breadcrumb,
  actions,
  floatingActions,
  user,
  autoLoadUser = true,
  children,
}: {
  title?: string;
  breadcrumb?: BreadcrumbItem[];
  actions?: React.ReactNode;
  floatingActions?: React.ReactNode;
  user?: HeaderUser | null;
  autoLoadUser?: boolean;
  children: React.ReactNode;
}) {
  const [menuAberto, setMenuAberto] = useState(false);

  // Corte por ociosidade: o painel expõe KYC e dados pessoais.
  useSessaoExpira();
  const pathname = usePathname();

  // Navegar fecha a gaveta — senão ela cobriria a página recém-aberta.
  useEffect(() => {
    setMenuAberto(false);
  }, [pathname]);

  // Trava o scroll do fundo enquanto a gaveta está aberta.
  useEffect(() => {
    if (!menuAberto) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [menuAberto]);

  return (
    <div className="flex min-h-screen bg-surface-secondary text-fg">
      {/* Fundo escurecido: só existe no mobile, com a gaveta aberta. */}
      {menuAberto ? (
        <div
          aria-hidden
          onClick={() => setMenuAberto(false)}
          className="fixed inset-0 z-40 bg-fg/40 md:hidden"
        />
      ) : null}

      <Sidebar user={user} mobileOpen={menuAberto} onCloseMobile={() => setMenuAberto(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          title={title}
          actions={actions}
          user={user}
          autoLoadUser={autoLoadUser}
          onOpenMenu={() => setMenuAberto(true)}
        />

        {breadcrumb && breadcrumb.length > 0 ? (
          <div className="flex h-11 shrink-0 items-center overflow-x-auto border-b border-border bg-surface px-4 md:px-8">
            <Breadcrumb items={breadcrumb} />
          </div>
        ) : null}

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>

      {floatingActions ? (
        <div className="fixed bottom-6 right-6 z-20 flex flex-col items-end gap-3">
          {floatingActions}
        </div>
      ) : null}
    </div>
  );
}
