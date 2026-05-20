export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { AdminPage } from "@/components/admin-ui/AdminPage";
import VerificacoesClient from "./VerificacoesClient";

export default function VerificacoesPage() {
  return (
    <AdminPage
      title="Verificações documentais"
      subtitle="Revise documentos dos perfis antes da liberação pelo SafeScore Guardian."
    >
      <VerificacoesClient />
    </AdminPage>
  );
}
