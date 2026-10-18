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
type Linha = {
  temUser: boolean;
  role: string | null;
  status: string | null;
  dVerificacao: string | null;
  dDoc: boolean;
  dAt: Date | null;
  mVerificado: boolean | null;
  mAt: Date | null;
  eAt: Date | null;
  docId: string | null;
  docStatus: string | null;
  docAt: Date | null;
  scoreAt: Date | null;
  assAt: Date | null;
  lojasN: number;
  lojasAt: Date | null;
  restN: number;
  restCriada: Date | null;
  restRevogada: Date | null;
  servN: number;
  servAt: Date | null;
  avisosN: number;
  avisosAt: Date | null;
};

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
  // UMA consulta (antes eram 11, mais a da sessão): cada assunto vem de um
  // índice próprio (chave única por userId, índices de Servico por ponta e de
  // Notification por userId+readAt). Em produção o custo é de ida e volta ao
  // banco, não de execução — por isso tudo numa ida só.
  const [l] = await prisma.$queryRaw<Linha[]>`
    SELECT
      (u.id IS NOT NULL) AS "temUser", u.role::text AS "role", u.status::text AS "status",
      dp.verificacao::text AS "dVerificacao", (COALESCE(dp."docUrl", '') <> '') AS "dDoc", dp."updatedAt" AS "dAt",
      mp.verificado AS "mVerificado", mp."updatedAt" AS "mAt",
      ep."updatedAt" AS "eAt",
      dv.id AS "docId", dv.status::text AS "docStatus", dv."updatedAt" AS "docAt",
      sp."updatedAt" AS "scoreAt",
      sub."updatedAt" AS "assAt",
      lj.n AS "lojasN", lj.at AS "lojasAt",
      rs.n AS "restN", rs.criada AS "restCriada", rs.revogada AS "restRevogada",
      sv.n AS "servN", sv.at AS "servAt",
      av.n AS "avisosN", av.at AS "avisosAt"
    FROM (SELECT ${userId}::text AS id) k
    LEFT JOIN "User" u ON u.id = k.id
    LEFT JOIN "DiaristaProfile" dp ON dp."userId" = k.id
    LEFT JOIN "MontadorPerfil" mp ON mp."userId" = k.id
    LEFT JOIN "EmpregadorPerfil" ep ON ep."userId" = k.id
    LEFT JOIN "SafeScoreProfile" sp ON sp."userId" = k.id
    LEFT JOIN "Subscription" sub ON sub."userId" = k.id
    LEFT JOIN LATERAL (
      SELECT id, status, "updatedAt" FROM "DocumentVerification" WHERE "userId" = k.id ORDER BY "updatedAt" DESC LIMIT 1
    ) dv ON true
    CROSS JOIN LATERAL (SELECT count(*)::int AS n, max("updatedAt") AS at FROM "AssinaturaLoja" WHERE "userId" = k.id) lj
    CROSS JOIN LATERAL (
      SELECT count(*)::int AS n, max("createdAt") AS criada, max("revokedAt") AS revogada FROM "UserRestriction" WHERE "userId" = k.id
    ) rs
    -- Solicitações e agenda: todo serviço em que a conta é cliente ou
    -- profissional. Mudança de status de um serviço muda a versão das DUAS pontas.
    CROSS JOIN LATERAL (
      SELECT count(*)::int AS n, max("updatedAt") AS at FROM "Servico"
      WHERE "clientId" = k.id OR "diaristaId" = k.id OR "montadorId" = k.id
    ) sv
    -- Contadores: avisos não lidos e o mais recente.
    CROSS JOIN LATERAL (
      SELECT count(*)::int AS n, max("createdAt") AS at FROM "Notification" WHERE "userId" = k.id AND "readAt" IS NULL
    ) av
  `;
  const t = (d: Date | null | undefined) => d?.getTime() ?? null;
  // Uma versão por assunto: a tela relê só o que mudou. Mesma representação da
  // versão anterior desta rota (com Prisma por tabela): o deploy não muda as
  // versões já entregues ao app.
  const assuntos = {
    conta: l.temUser ? [l.role, l.status] : null,
    verificacao: [l.dVerificacao, l.dDoc, l.mVerificado, l.docId ? [l.docId, l.docStatus, t(l.docAt)] : null],
    perfil: [t(l.dAt), t(l.mAt), t(l.eAt)],
    safescore: t(l.scoreAt),
    assinatura: [t(l.assAt), l.lojasN, t(l.lojasAt)],
    restricoes: [l.restN, t(l.restCriada), t(l.restRevogada)],
    servicos: [l.servN, t(l.servAt)],
    avisos: [l.avisosN, t(l.avisosAt)],
  };
  const resumo = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 12);
  const versoes = Object.fromEntries(Object.entries(assuntos).map(([k, v]) => [k, resumo(v)]));
  return NextResponse.json(
    { ok: true, userId, versao: resumo(versoes), versoes },
    // Resposta por pessoa: nunca em cache compartilhado (CDN, proxy).
    { headers: { "cache-control": "private, no-store, max-age=0", vary: "Authorization" } },
  );
}
