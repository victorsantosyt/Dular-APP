import { NextResponse } from "next/server";
import { gateAdmin } from "@/lib/adminGate";
import { listAdminVerificacoes } from "@/lib/adminVerificacoes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


export async function GET(req: Request) {
  const gate = await gateAdmin(req);
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
