import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAtivo } from "@/lib/contaAtiva";
import { requireAdmin } from "@/lib/requireAuth";
import { varrerOperacoes } from "@/lib/trocaDePlano";

export const dynamic = "force-dynamic";

/**
 * Operações de cobrança Stripe que não terminaram (lib/trocaDePlano). Elas
 * também são retomadas no próximo pedido do usuário, nos eventos da
 * assinatura e pela varredura do servidor (boot e intervalo); esta rota é a
 * varredura sob demanda, sem esperar os prazos.
 *
 * GET  — pendentes, aguardando pagamento e falhas, mais antigas primeiro.
 * POST — varre agora: retoma as pendentes e confere as que aguardam.
 */
/** Papel conferido no BANCO, não no token: quem deixou de ser admin perde o acesso na hora. */
async function exigirAdmin(req: Request) {
  const auth = await requireAuthAtivo(req);
  try {
    await requireAdmin(auth);
    return true;
  } catch {
    return false;
  }
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
    const { examinadas, falhas, emAndamento } = await varrerOperacoes({ imediato: true, limite: 50 });
    if (emAndamento) return NextResponse.json({ ok: false, error: "Outra varredura em andamento; tente em instantes." }, { status: 409 });
    return NextResponse.json({ ok: falhas === 0, examinadas, falhas }, { status: falhas === 0 ? 200 : 503 });
  } catch (err) {
    console.error("[ops/stripe-operacoes] varredura interrompida; as operações seguem gravadas:", err);
    return NextResponse.json({ ok: false, error: "Varredura interrompida; tente novamente." }, { status: 503 });
  }
}
