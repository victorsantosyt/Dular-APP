import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAtivo, respostaDeSessao } from "@/lib/contaAtiva";

export const dynamic = "force-dynamic";

/**
 * Token de push do APARELHO (Expo). Hoje é um campo único em `User`: vale o
 * último aparelho em que a pessoa entrou — um segundo aparelho substitui o
 * primeiro. Limitação conhecida, documentada no Lote A do chat.
 *
 * O token identifica o aparelho, não a pessoa. Por isso:
 * - POST: ao associar à conta atual, desassocia de QUALQUER outra conta. Sem
 *   isso, quem troca de conta no mesmo aparelho continuava recebendo os
 *   avisos da conta anterior, com conversas de outra pessoa na tela.
 * - DELETE (logout): desassocia só se o token guardado for o DESTE aparelho.
 *   Se a pessoa já entrou em outro aparelho, o token guardado é outro e fica.
 */
function tokenValido(valor: unknown): valor is string {
  return typeof valor === "string" && valor.startsWith("ExponentPushToken[");
}

async function lerToken(req: Request): Promise<unknown> {
  const body = (await req.json().catch(() => null)) as { pushToken?: unknown } | null;
  return body?.pushToken;
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuthAtivo(req);
    const pushToken = await lerToken(req);

    if (!pushToken || typeof pushToken !== "string") {
      return NextResponse.json({ ok: false, error: "pushToken inválido." }, { status: 400 });
    }
    if (!tokenValido(pushToken)) {
      return NextResponse.json({ ok: false, error: "Formato de token inválido." }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.user.updateMany({
        where: { pushToken, id: { not: auth.userId } },
        data: { pushToken: null },
      }),
      prisma.user.update({
        where: { id: auth.userId },
        data: { pushToken },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const sessao = respostaDeSessao(e);
    if (sessao) return sessao;
    return NextResponse.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireAuthAtivo(req);
    const pushToken = await lerToken(req);

    if (!tokenValido(pushToken)) {
      return NextResponse.json({ ok: false, error: "pushToken inválido." }, { status: 400 });
    }

    const { count } = await prisma.user.updateMany({
      where: { id: auth.userId, pushToken },
      data: { pushToken: null },
    });

    return NextResponse.json({ ok: true, removido: count > 0 });
  } catch (e: unknown) {
    const sessao = respostaDeSessao(e);
    if (sessao) return sessao;
    return NextResponse.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}
