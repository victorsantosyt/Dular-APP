import Sidebar from "./Sidebar";
import Header, { type HeaderUser } from "./Header";
import Breadcrumb, { type BreadcrumbItem } from "./Breadcrumb";

/**
 * AdminLayout — estrutura definitiva de todas as páginas do painel.
 *
 *   AdminLayout
 *   ├── Sidebar          (fixa, esquerda, 264px)
 *   ├── Header           (título + busca + notificações + avatar)
 *   ├── Breadcrumb       (trilha, slot próprio)
 *   ├── MainContent      (children)
 *   └── FloatingActions  (opcional, canto inferior direito)
 *
 * Meta: páginas apenas montam componentes. Nenhum <div> de chrome nas páginas.
 */
export default function AdminLayout({
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
  return (
    <div className="flex min-h-screen bg-surface-secondary text-fg">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header title={title} actions={actions} user={user} autoLoadUser={autoLoadUser} />

        {breadcrumb && breadcrumb.length > 0 ? (
          <div className="flex h-11 shrink-0 items-center border-b border-border bg-surface px-6">
            <Breadcrumb items={breadcrumb} />
          </div>
        ) : null}

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-6">{children}</main>
      </div>

      {floatingActions ? (
        <div className="fixed bottom-6 right-6 z-20 flex flex-col items-end gap-3">
          {floatingActions}
        </div>
      ) : null}
    </div>
  );
}
