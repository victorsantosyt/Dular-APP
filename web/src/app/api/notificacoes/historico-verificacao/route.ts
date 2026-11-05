import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAtivo, respostaDeSessao } from "@/lib/contaAtiva";
import { SELECT_ENVIO, SELECT_EVENTO, TIPOS_VERIFICACAO } from "@/lib/cardsNotificacoes";

export const dynamic = "force-dynamic";

// GET /api/notificacoes/historico-verificacao
//
// Histórico da verificação da conta: cada envio com todas as decisões e os
// avisos ligados a elas por vínculo explícito; avisos sem vínculo à parte.
// Só da conta de quem pede. Não marca nada como lido (isso é ler-lote, com os
// ids que o app de fato mostrou).
export async function GET(req: Request) {
  try {
    const auth = await requireAuthAtivo(req);
    const [envios, avisos] = await Promise.all([
      prisma.documentVerification.findMany({ where: { userId: auth.userId }, orderBy: { createdAt: "desc" }, select: SELECT_ENVIO }),
      prisma.notification.findMany({
        where: { userId: auth.userId, type: { in: [...TIPOS_VERIFICACAO] } },
        orderBy: { createdAt: "desc" },
        select: SELECT_EVENTO,
      }),
    ]);
    const atualId = envios[0]?.id ?? null;
    const idsEnvios = new Set(envios.map((e) => e.id));
    const evento = (a: (typeof avisos)[number]) => ({ id: a.id, type: a.type, title: a.title, body: a.body, createdAt: a.createdAt.toISOString(), readAt: a.readAt ? a.readAt.toISOString() : null });

    return NextResponse.json({
      ok: true,
      envios: envios.map((e) => ({
        id: e.id,
        atual: e.id === atualId,
        enviadoEm: e.createdAt.toISOString(),
        status: e.status,
        decisoes: e.decisoes.map((d) => ({
          id: d.id,
          decisao: d.decisao,
          em: d.createdAt.toISOString(),
          avisos: avisos.filter((a) => a.verificacaoId === e.id && a.decisaoVerificacaoId === d.id).map(evento),
        })),
      })),
      semVinculo: avisos.filter((a) => !a.verificacaoId || !idsEnvios.has(a.verificacaoId)).map(evento),
    });
  } catch (error: unknown) {
    const sessao = respostaDeSessao(error);
    if (sessao) return sessao;
    console.error("[notificacoes/historico-verificacao GET] erro interno.");
    return NextResponse.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}
