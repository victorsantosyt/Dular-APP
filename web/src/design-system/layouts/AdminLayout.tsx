import AdminChrome from "./AdminChrome";
import { type HeaderUser } from "./Header";
import { type BreadcrumbItem } from "./Breadcrumb";

/**
 * AdminLayout — estrutura definitiva de todas as páginas do painel.
 *
 *   AdminLayout (server)
 *   └── AdminChrome (client — estado da gaveta no mobile)
 *       ├── Sidebar          (fixa no desktop, gaveta no mobile)
 *       ├── Header           (título + notificações + avatar)
 *       ├── Breadcrumb       (trilha, slot próprio)
 *       ├── MainContent      (children)
 *       └── FloatingActions  (opcional, canto inferior direito)
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
    <AdminChrome
      title={title}
      breadcrumb={breadcrumb}
      actions={actions}
      floatingActions={floatingActions}
      user={user}
      autoLoadUser={autoLoadUser}
    >
      {children}
    </AdminChrome>
  );
}
