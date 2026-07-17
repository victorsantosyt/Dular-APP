import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { AdminLayout } from "@/design-system/layouts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Catálogo do Design System — ambiente de testes/documentação viva.
 *
 * Reutiliza a MESMA proteção de admin das rotas (protected). Serve como a
 * primeira tela real a montar o novo AdminLayout (sem substituir o shell atual).
 */
export default async function DesignSystemLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("dular_token")?.value;

  if (!token) redirect("/admin/login");

  let session: { role?: string } | null = null;
  try {
    session = verifyToken(token);
  } catch {
    redirect("/admin/login");
  }

  if (!session || session.role !== "ADMIN") redirect("/admin/login");

  return (
    <AdminLayout
      title="Design System"
      breadcrumb={[{ label: "Painel", href: "/admin" }, { label: "Design System" }]}
    >
      {children}
    </AdminLayout>
  );
}
