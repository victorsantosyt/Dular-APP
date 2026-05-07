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

  const servicos = await prisma.servico.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, createdAt: true, precoFinal: true },
  });

  const lines = [
    csvLine(["id", "status", "createdAt", "valor"]),
    ...servicos.map((servico) =>
      csvLine([servico.id, servico.status, servico.createdAt.toISOString(), servico.precoFinal])
    ),
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="servicos.csv"',
    },
  });
}
