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
    <div className="relative flex min-h-screen overflow-hidden bg-accent-subtle text-fg">
      {/* Manchas roxas desfocadas — dão a cor/atmosfera ao fundo por trás do glass */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-primary-200/60 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-10%] top-1/3 h-[380px] w-[380px] rounded-full bg-primary-300/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[-15%] left-1/3 h-[440px] w-[440px] rounded-full bg-accent/20 blur-3xl"
      />

      <Sidebar user={user} />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <Header title={title} actions={actions} user={user} autoLoadUser={autoLoadUser} />

        {breadcrumb && breadcrumb.length > 0 ? (
          <div className="flex h-11 shrink-0 items-center border-b border-glass-border bg-glass-surface px-6 backdrop-blur-md">
            <Breadcrumb items={breadcrumb} />
          </div>
        ) : null}

        <main className="relative mx-auto w-full max-w-[1400px] flex-1 px-6 py-6">{children}</main>
      </div>

      {floatingActions ? (
        <div className="fixed bottom-6 right-6 z-20 flex flex-col items-end gap-3">
          {floatingActions}
        </div>
      ) : null}
    </div>
  );
}
