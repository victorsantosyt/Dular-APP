import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken, type JwtPayload } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { HeaderUser } from "@/design-system/layouts/Header";

/**
 * Autenticação compartilhada do painel: lê o cookie `dular_token`, valida o
 * JWT, exige ADMIN ativo no BANCO e já resolve os dados de exibição (nome/
 * avatar) usados pela Sidebar/Header — evita repetir esse bloco em cada
 * layout.tsx e evita um segundo fetch client-side de /api/me/header.
 * Redireciona pra /admin/login internamente; nunca retorna sessão inválida.
 *
 * Chamada também no início de cada página que lê dado sensível: o layout e a
 * página do App Router renderizam em paralelo, então a página não pode contar
 * com o redirecionamento do layout antes de consultar o banco.
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

  // O token não basta: a conta precisa estar ativa e AINDA ser ADMIN no banco.
  // Ex-admin com token antigo ou admin bloqueado volta para o login antes de
  // qualquer dado ser lido ou link assinado.
  const user = await adminAtivoDaSessao(session);
  if (!user) redirect("/admin/login");

  return { session, user };
}

/** Conta da sessão, se estiver ativa e ainda for ADMIN no banco; senão, nulo. */
export async function adminAtivoDaSessao(session: JwtPayload): Promise<HeaderUser | null> {
  if (session.role !== "ADMIN") return null;
  const record = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, nome: true, avatarUrl: true, role: true, status: true },
  });
  if (!record || record.role !== "ADMIN" || record.status !== "ATIVO") return null;
  const { status: _status, ...exibicao } = record;
  return { ...exibicao, role: record.role };
}

/**
 * Para rotas (route.ts) do painel, que não passam pelo layout: o token do cookie
 * é de uma conta ativa e ainda ADMIN no banco?
 */
export async function adminAtivoNoBanco(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  let session: JwtPayload;
  try {
    session = verifyToken(token);
  } catch {
    return false;
  }
  return (await adminAtivoDaSessao(session)) !== null;
}
