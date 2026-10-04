import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAtivo } from "@/lib/contaAtiva";
import { retomarOperacoes } from "@/lib/trocaDePlano";

export const dynamic = "force-dynamic";

/**
 * Operações de cobrança Stripe que não terminaram (lib/trocaDePlano). Elas
 * também são retomadas no próximo pedido do usuário e nos eventos da
 * assinatura; esta rota é a retomada que não depende de nenhum dos dois.
 *
 * GET  — pendentes, aguardando pagamento e falhas, mais antigas primeiro.
 * POST — retoma as pendentes (cada uma sob a trava do seu usuário).
 */
async function exigirAdmin(req: Request) {
  const auth = await requireAuthAtivo(req);
  return auth.role === "ADMIN";
}

export async function GET(req: Request) {
  try {
    if (!(await exigirAdmin(req))) return NextResponse.json({ ok: false, error: "Apenas admin." }, { status: 403 });
  } catch {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }
  const operacoes = await prisma.stripeOperacao.findMany({
    where: { status: { in: ["pendente", "aguardando", "falhou"] } },
    select: {
      id: true, userId: true, tipo: true, status: true, planId: true, externalId: true,
      substituida: true, referencia: true, tentativas: true, erro: true, createdAt: true, updatedAt: true,
    },
    orderBy: { updatedAt: "asc" },
    take: 200,
  });
  return NextResponse.json({ ok: true, operacoes });
}

export async function POST(req: Request) {
  try {
    if (!(await exigirAdmin(req))) return NextResponse.json({ ok: false, error: "Apenas admin." }, { status: 403 });
  } catch {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }
  try {
    const { retomadas } = await retomarOperacoes({}, 50);
    return NextResponse.json({ ok: true, retomadas });
  } catch (err) {
    console.error("[ops/stripe-operacoes] retomada interrompida; as operações seguem pendentes:", err);
    return NextResponse.json({ ok: false, error: "Retomada interrompida; tente novamente." }, { status: 503 });
  }
}
