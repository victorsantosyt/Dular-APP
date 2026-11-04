import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAtivo, respostaDeSessao } from "@/lib/contaAtiva";
import { relacaoDoAviso, TIPOS_DE_AVISO_DE_VERIFICACAO } from "@/lib/contextoAvisoVerificacao";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// GET /api/notificacoes/[id]/contexto
//
// O que o app precisa para abrir um aviso sem confiar no texto dele. Para os
// avisos de verificação, diz se a decisão do aviso ainda vale
// (lib/contextoAvisoVerificacao); o estado atual da verificação continua
// vindo de /api/me. Aviso de outra conta responde 404, como se não existisse.
export async function GET(req: Request, { params }: Params) {
  try {
    const auth = await requireAuthAtivo(req);
    const { id } = await params;

    const aviso = await prisma.notification.findUnique({
      where: { id },
      select: { id: true, userId: true, type: true, createdAt: true, readAt: true, verificacaoId: true, decisaoVerificacaoId: true },
    });
    if (!aviso || aviso.userId !== auth.userId) {
      return NextResponse.json({ ok: false, error: "Notificação não encontrada." }, { status: 404 });
    }

    const base = { id: aviso.id, type: aviso.type, createdAt: aviso.createdAt, lida: aviso.readAt != null };
    if (!TIPOS_DE_AVISO_DE_VERIFICACAO.has(aviso.type)) {
      return NextResponse.json({ ok: true, notificacao: base, verificacao: null });
    }

    const envios = await prisma.documentVerification.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        createdAt: true,
        decididoEm: true,
        decisoes: { select: { id: true, decisao: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      },
    });

    return NextResponse.json({ ok: true, notificacao: base, verificacao: relacaoDoAviso(aviso, envios) });
  } catch (error: unknown) {
    const sessao = respostaDeSessao(error);
    if (sessao) return sessao;
    console.error("[notificacoes/[id]/contexto GET] erro interno.");
    return NextResponse.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}
