import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAtivo, respostaDeSessao } from "@/lib/contaAtiva";

export const dynamic = "force-dynamic";

const MAX_IDS = 100;

// PATCH /api/notificacoes/ler-lote  { ids: string[] }
//
// Marca como lidas SÓ as notificações indicadas (as que o app mostrou) e só as
// da conta de quem pede: id de outra conta é ignorado, sem revelar se existe.
// Idempotente: o readAt de quem já foi lida não muda.
export async function PATCH(req: Request) {
  try {
    const auth = await requireAuthAtivo(req);
    const corpo = (await req.json().catch(() => null)) as { ids?: unknown } | null;
    const ids = Array.isArray(corpo?.ids) ? corpo!.ids.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 64) : [];
    if (ids.length === 0 || ids.length > MAX_IDS || ids.length !== (corpo?.ids as unknown[]).length) {
      return NextResponse.json({ ok: false, error: "Informe de 1 a 100 ids válidos." }, { status: 400 });
    }
    const r = await prisma.notification.updateMany({
      where: { id: { in: ids }, userId: auth.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true, marcadas: r.count });
  } catch (error: unknown) {
    const sessao = respostaDeSessao(error);
    if (sessao) return sessao;
    return NextResponse.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}
