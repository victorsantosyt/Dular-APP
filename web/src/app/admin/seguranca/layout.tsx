import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import AdminShell from "../_ui/AdminShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SegurancaLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("dular_token")?.value;

  if (!token) {
    redirect("/admin/login");
  }

  let session: any = null;
  try {
    session = verifyToken(token);
  } catch {
    redirect("/admin/login");
  }

  if (!session || session.role !== "ADMIN") {
    redirect("/admin/login");
  }

  return <AdminShell>{children}</AdminShell>;
}
