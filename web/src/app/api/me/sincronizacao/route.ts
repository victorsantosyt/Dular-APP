import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAuthAtivo, respostaDeSessao } from "@/lib/contaAtiva";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/me/sincronizacao — "algo da minha conta mudou?" em uma consulta barata.
 *
 * O app consulta com a tela aberta (e ao voltar do segundo plano, ao recuperar
 * a rede ou ao receber uma notificação). A resposta traz o `userId` — o app
 * descarta a de outra conta — e uma `versao` que muda quando muda qualquer dado
 * compartilhado entre telas: papel/status da conta, verificação documental,
 * perfil profissional, SafeScore, assinaturas e restrições. Só quando a versão
 * muda o app relê os dados completos.
 *
 * `User.updatedAt` fica de fora de propósito: o batimento de presença mexe nele
 * o tempo todo e faria o app reler tudo sem motivo.
 */
export async function GET(req: Request) {
  let auth;
  try {
    auth = await requireAuthAtivo(req);
  } catch (err) {
    const sessao = respostaDeSessao(err);
    if (sessao) return sessao;
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }
  const userId = auth.userId;
  const [user, diarista, montador, empregador, documento, score, assinatura, lojas, restricoes] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { role: true, status: true } }),
    prisma.diaristaProfile.findUnique({ where: { userId }, select: { verificacao: true, docUrl: true, updatedAt: true } }),
    prisma.montadorPerfil.findUnique({ where: { userId }, select: { verificado: true, updatedAt: true } }),
    prisma.empregadorPerfil.findUnique({ where: { userId }, select: { updatedAt: true } }),
    prisma.documentVerification.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" }, select: { id: true, status: true, updatedAt: true } }),
    prisma.safeScoreProfile.findUnique({ where: { userId }, select: { updatedAt: true } }),
    prisma.subscription.findUnique({ where: { userId }, select: { updatedAt: true } }),
    prisma.assinaturaLoja.aggregate({ where: { userId }, _max: { updatedAt: true }, _count: true }),
    prisma.userRestriction.aggregate({ where: { userId }, _max: { createdAt: true, revokedAt: true }, _count: true }),
  ]);
  const estado = {
    conta: user ? [user.role, user.status] : null,
    diarista: diarista ? [diarista.verificacao, Boolean(diarista.docUrl), diarista.updatedAt.getTime()] : null,
    montador: montador ? [montador.verificado, montador.updatedAt.getTime()] : null,
    empregador: empregador?.updatedAt.getTime() ?? null,
    documento: documento ? [documento.id, documento.status, documento.updatedAt.getTime()] : null,
    score: score?.updatedAt.getTime() ?? null,
    assinatura: assinatura?.updatedAt.getTime() ?? null,
    lojas: [lojas._count, lojas._max.updatedAt?.getTime() ?? null],
    restricoes: [restricoes._count, restricoes._max.createdAt?.getTime() ?? null, restricoes._max.revokedAt?.getTime() ?? null],
  };
  const versao = createHash("sha256").update(JSON.stringify(estado)).digest("hex").slice(0, 24);
  return NextResponse.json(
    { ok: true, userId, versao },
    { headers: { "cache-control": "no-store" } },
  );
}
