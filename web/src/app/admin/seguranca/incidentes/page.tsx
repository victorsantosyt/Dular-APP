import AdminIncidentes from "../../incidentes/page";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function SegurancaIncidentesPage() {
  return <AdminIncidentes />;
}
