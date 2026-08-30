export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { AdminPage } from "@/components/admin-ui/AdminPage";
import { AdminGrid } from "@/components/admin-ui/AdminGrid";
import { AdminCard } from "@/components/admin-ui/AdminCard";
import { Download } from "lucide-react";

const downloads = [
  {
    title: "Usuários",
    description: "nome, email, role, createdAt",
    href: "/admin/insights/downloads/usuarios",
  },
  {
    title: "Serviços",
    description: "id, status, createdAt, valor",
    href: "/admin/insights/downloads/servicos",
  },
];

export default function DownloadsPage() {
  return (
    <AdminPage title="Downloads" subtitle="Exportações operacionais em CSV">
      <AdminGrid>
        {downloads.map((item) => (
          <div key={item.href} className="md:col-span-6">
            <AdminCard title={item.title} icon={Download}>
              <p className="text-sm text-fg-subtle">{item.description}</p>
              <a
                href={item.href}
                className="mt-4 inline-flex rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-95 active:brightness-90"
              >
                Exportar CSV
              </a>
            </AdminCard>
          </div>
        ))}
      </AdminGrid>
    </AdminPage>
  );
}
