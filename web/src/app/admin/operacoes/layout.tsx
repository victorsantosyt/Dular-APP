import { requireAdminSession } from "@/lib/adminSession";
import { AdminLayout } from "@/design-system/layouts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OperacoesLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdminSession();

  return (
    <AdminLayout user={user} autoLoadUser={false}>
      {children}
    </AdminLayout>
  );
}
