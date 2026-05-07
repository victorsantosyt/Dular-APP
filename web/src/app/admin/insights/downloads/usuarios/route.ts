import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("dular_token")?.value;
  if (!token) return false;
  try {
    const session = verifyToken(token);
    return session.role === "ADMIN";
  } catch {
    return false;
  }
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function csvLine(values: unknown[]) {
  return values.map(csvCell).join(",");
}

export async function GET() {
  if (!(await requireAdmin())) {
    return new Response("Não autorizado", { status: 401 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { nome: true, email: true, role: true, createdAt: true },
  });

  const lines = [
    csvLine(["nome", "email", "role", "createdAt"]),
    ...users.map((user) => csvLine([user.nome, user.email, user.role, user.createdAt.toISOString()])),
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="usuarios.csv"',
    },
  });
}
