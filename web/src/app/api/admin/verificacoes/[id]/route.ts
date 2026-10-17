import { NextResponse } from "next/server";
import { gateAdmin } from "@/lib/adminGate";
import { getAdminVerificacaoDetail } from "@/lib/adminVerificacoes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await gateAdmin(req);
  if (gate.error) return gate.error;

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ ok: false, error: "ID inválido." }, { status: 400 });
  }

  try {
    const detail = await getAdminVerificacaoDetail(id.trim());
    if (!detail) {
      return NextResponse.json({ ok: false, error: "Verificação não encontrada." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...detail });
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[admin/verificacoes/:id] GET falhou:", err);
    }
    return NextResponse.json({ ok: false, error: "Erro ao carregar verificação." }, { status: 500 });
  }
}
