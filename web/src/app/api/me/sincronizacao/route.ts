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
 * compartilhado entre telas — conta, verificação documental, perfil
 * profissional, SafeScore, assinatura, restrições, serviços (solicitações e
 * agenda, das duas pontas) e avisos não lidos —, com uma versão por assunto:
 * o app relê só as telas do assunto que mudou.
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
  const [user, diarista, montador, empregador, documento, score, assinatura, lojas, restricoes, servicos, avisos] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { role: true, status: true } }),
    prisma.diaristaProfile.findUnique({ where: { userId }, select: { verificacao: true, docUrl: true, updatedAt: true } }),
    prisma.montadorPerfil.findUnique({ where: { userId }, select: { verificado: true, updatedAt: true } }),
    prisma.empregadorPerfil.findUnique({ where: { userId }, select: { updatedAt: true } }),
    prisma.documentVerification.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" }, select: { id: true, status: true, updatedAt: true } }),
    prisma.safeScoreProfile.findUnique({ where: { userId }, select: { updatedAt: true } }),
    prisma.subscription.findUnique({ where: { userId }, select: { updatedAt: true } }),
    prisma.assinaturaLoja.aggregate({ where: { userId }, _max: { updatedAt: true }, _count: true }),
    prisma.userRestriction.aggregate({ where: { userId }, _max: { createdAt: true, revokedAt: true }, _count: true }),
    // Solicitações e agenda: todo serviço em que a conta é cliente ou profissional
    // (índices em clientId, diaristaId e montadorId). Mudança de status de um
    // serviço muda a versão das DUAS pontas.
    prisma.servico.aggregate({
      where: { OR: [{ clientId: userId }, { diaristaId: userId }, { montadorId: userId }] },
      _max: { updatedAt: true },
      _count: true,
    }),
    // Contadores: avisos não lidos e o mais recente (índice userId+readAt).
    prisma.notification.aggregate({ where: { userId, readAt: null }, _max: { createdAt: true }, _count: true }),
  ]);
  const t = (d: Date | null | undefined) => d?.getTime() ?? null;
  // Uma versão por assunto: a tela relê só o que mudou.
  const assuntos = {
    conta: user ? [user.role, user.status] : null,
    verificacao: [diarista?.verificacao ?? null, Boolean(diarista?.docUrl), montador?.verificado ?? null, documento ? [documento.id, documento.status, t(documento.updatedAt)] : null],
    perfil: [t(diarista?.updatedAt), t(montador?.updatedAt), t(empregador?.updatedAt)],
    safescore: t(score?.updatedAt),
    assinatura: [t(assinatura?.updatedAt), lojas._count, t(lojas._max.updatedAt)],
    restricoes: [restricoes._count, t(restricoes._max.createdAt), t(restricoes._max.revokedAt)],
    servicos: [servicos._count, t(servicos._max.updatedAt)],
    avisos: [avisos._count, t(avisos._max.createdAt)],
  };
  const resumo = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 12);
  const versoes = Object.fromEntries(Object.entries(assuntos).map(([k, v]) => [k, resumo(v)]));
  return NextResponse.json(
    { ok: true, userId, versao: resumo(versoes), versoes },
    // Resposta por pessoa: nunca em cache compartilhado (CDN, proxy).
    { headers: { "cache-control": "private, no-store, max-age=0", vary: "Authorization" } },
  );
}
