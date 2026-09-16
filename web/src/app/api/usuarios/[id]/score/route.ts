import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { requireAuthAtivo, respostaDeSessao } from "@/lib/contaAtiva";
import { getFaixa } from "@/lib/safeScore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Quem pode ver a faixa de `alvo`.
 *
 * Antes, qualquer conta autenticada lia a faixa de qualquer id — inclusive
 * `bloqueado` e "Risco Alto"/"Suspenso" de empregadores com quem nunca teve
 * relação. Não dá para fechar em "só o dono": o app mostra a faixa da
 * contraparte em três fluxos (empregador vendo a diarista antes de contratar,
 * diarista vendo o cliente do serviço, montador vendo o empregador da
 * solicitação). A regra libera exatamente esses casos:
 *
 *   - o próprio usuário e ADMIN;
 *   - alvo PROFISSIONAL (DIARISTA/MONTADOR): já aparece na busca pública, e a
 *     faixa é o sinal de confiança de quem vai contratar;
 *   - qualquer outro alvo (EMPREGADOR, ADMIN): só o profissional que tem ou
 *     teve serviço com ele, em qualquer status.
 *
 * Lista explícita de papéis profissionais: um papel novo — ou `role` nulo,
 * que o schema permite — cai no caso restrito até alguém decidir o contrário.
 */
async function podeVerFaixa(
  viewer: { userId: string; role: string },
  alvo: { id: string; role: string | null },
): Promise<boolean> {
  if (viewer.userId === alvo.id) return true;
  if (viewer.role === "ADMIN") return true;
  if (alvo.role === "DIARISTA" || alvo.role === "MONTADOR") return true;

  const vinculo = await prisma.servico.findFirst({
    where: {
      clientId: alvo.id,
      OR: [{ diaristaId: viewer.userId }, { montadorId: viewer.userId }],
    },
    select: { id: true },
  });
  return vinculo !== null;
}

export async function GET(req: Request, { params }: Params) {
  try {
    const auth = await requireAuthAtivo(req);

    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        diaristaProfile: {
          select: {
            totalServicos: true,
            verificacao: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: "Usuário não encontrado" }, { status: 404 });
    }

    if (!(await podeVerFaixa(auth, user))) {
      return NextResponse.json({ ok: false, error: "Acesso negado." }, { status: 403 });
    }

    // Só o V2: sem perfil, 500/BRONZE. O legado não é consultado.
    const profile = await prisma.safeScoreProfile.findUnique({
      where: { userId: id },
      select: { currentScore: true, tier: true },
    });
    const score = profile?.currentScore ?? 500;
    const tier = profile?.tier ?? "BRONZE";

    const totalServicos =
      user.diaristaProfile?.totalServicos ??
      (await prisma.servico.count({
        where: {
          status: "FINALIZADO",
          OR: [{ clientId: id }, { diaristaId: id }],
        },
      }));

    const faixaData = getFaixa(score);

    return NextResponse.json({
      faixa: faixaData.label,
      cor: faixaData.cor,
      bloqueado: faixaData.bloqueado,
      tier,
      totalServicos,
      verificado: user.diaristaProfile?.verificacao === "VERIFICADO",
    });
  } catch (e: any) {
    const sessao = respostaDeSessao(e);
    if (sessao) return sessao;
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}
