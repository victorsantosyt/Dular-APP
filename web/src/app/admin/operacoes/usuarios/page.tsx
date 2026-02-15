export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin-ui/AdminPage";
import { AdminGrid } from "@/components/admin-ui/AdminGrid";
import { AdminKpi } from "@/components/admin-ui/AdminKpi";
import { AdminCard } from "@/components/admin-ui/AdminCard";
import { AdminTable } from "@/components/admin-ui/AdminTable";
import { AdminEmpty } from "@/components/admin-ui/AdminEmpty";

export default async function UsuariosPage() {
  const [total, clientes, diaristas, admins, rows] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "CLIENTE" } }),
    prisma.user.count({ where: { role: "DIARISTA" } }),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, nome: true, telefone: true, email: true, role: true, createdAt: true },
    }),
  ]);

  return (
    <AdminPage title="" subtitle="">
      <AdminGrid>
        <div className="md:col-span-3">
          <AdminKpi label="Total" value={String(total)} />
        </div>
        <div className="md:col-span-3">
          <AdminKpi label="Clientes" value={String(clientes)} />
        </div>
        <div className="md:col-span-3">
          <AdminKpi label="Diaristas" value={String(diaristas)} />
        </div>
        <div className="md:col-span-3">
          <AdminKpi label="Admins" value={String(admins)} />
        </div>

        <div className="md:col-span-12">
          <AdminCard title="Últimos cadastrados">
            {rows.length === 0 ? (
              <AdminEmpty title="Sem dados ainda" hint="Quando houver usuários cadastrados, aparecem aqui." />
            ) : (
              <AdminTable
                columns={[
                  { key: "nome", label: "Nome" },
                  { key: "telefone", label: "Telefone" },
                  { key: "email", label: "Email" },
                  { key: "role", label: "Perfil" },
                  {
                    key: "createdAt",
                    label: "Criado em",
                    render: (r) => new Date(r.createdAt).toLocaleString("pt-BR"),
                  },
                ]}
                rows={rows}
              />
            )}
          </AdminCard>
        </div>
      </AdminGrid>
    </AdminPage>
  );
}
