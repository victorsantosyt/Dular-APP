import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Conteúdo canônico mora em /admin/incidentes — esta rota existia como uma
// segunda cópia da mesma página (com seu próprio layout/auth-check). Mantida
// só como redirect pra não quebrar links/favoritos existentes.
export default function SegurancaIncidentesPage() {
  redirect("/admin/incidentes");
}
