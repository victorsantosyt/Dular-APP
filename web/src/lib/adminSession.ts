import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken, type JwtPayload } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { HeaderUser } from "@/design-system/layouts/Header";

/**
 * Autenticação compartilhada dos layouts do painel: lê o cookie `dular_token`,
 * valida o JWT, exige role ADMIN e já resolve os dados de exibição (nome/
 * avatar) usados pela Sidebar/Header — evita repetir esse bloco em cada
 * layout.tsx e evita um segundo fetch client-side de /api/me/header.
 * Redireciona pra /admin/login internamente; nunca retorna sessão inválida.
 */
export async function requireAdminSession(): Promise<{
  session: JwtPayload;
  user: HeaderUser | null;
}> {
  const cookieStore = await cookies();
  const token = cookieStore.get("dular_token")?.value;

  if (!token) redirect("/admin/login");

  let session: JwtPayload | null = null;
  try {
    session = verifyToken(token);
  } catch {
    redirect("/admin/login");
  }

  if (!session || session.role !== "ADMIN") {
    redirect("/admin/login");
  }

  const record = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, nome: true, avatarUrl: true, role: true },
  });

  const user: HeaderUser | null = record
    ? { ...record, role: record.role ?? session.role }
    : null;

  return { session, user };
}
