import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import { listAdminVerificacoes } from "@/lib/adminVerificacoes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requireAdmin(req: Request) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "ADMIN") {
      return { error: NextResponse.json({ ok: false, error: "Acesso negado." }, { status: 403 }) };
    }
    return { auth };
  } catch {
    return { error: NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 }) };
  }
}

export async function GET(req: Request) {
  const gate = requireAdmin(req);
  if (gate.error) return gate.error;

  try {
    const url = new URL(req.url);
    const data = await listAdminVerificacoes({
      status: url.searchParams.get("status"),
      role: url.searchParams.get("role"),
      q: url.searchParams.get("q"),
      page: url.searchParams.get("page"),
      limit: url.searchParams.get("limit"),
    });
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[admin/verificacoes] GET falhou:", err);
    }
    return NextResponse.json({ ok: false, error: "Erro ao carregar verificações." }, { status: 500 });
  }
}
