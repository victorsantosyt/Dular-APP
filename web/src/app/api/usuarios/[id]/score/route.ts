import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAtivo, respostaDeSessao } from "@/lib/contaAtiva";
import { canReadScore, countCompletedServices, readScorePresentation } from "@/lib/safeScore/presentation";
import { getDiaristaVerificationStatus, getMontadorVerificationStatus, getEmpregadorVerificationStatus } from "@/lib/profileVerification";

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

    if (!(await canReadScore(auth, user))) {
      return NextResponse.json({ ok: false, error: "Acesso negado." }, { status: 403 });
    }

    const [reputation, totalServicos, identity] = await Promise.all([
      readScorePresentation(id), countCompletedServices(id),
      user.role === "DIARISTA" ? getDiaristaVerificationStatus(id)
        : user.role === "MONTADOR" ? getMontadorVerificationStatus(id)
        : user.role === "EMPREGADOR" ? getEmpregadorVerificationStatus(id) : Promise.resolve(null),
    ]);
    if (!reputation) return NextResponse.json({ error: "SafeScore indisponível." }, { status: 503 });
    return NextResponse.json({ ...reputation, totalServicos, verificado: identity === "VERIFICADO" });
  } catch (e: any) {
    const sessao = respostaDeSessao(e);
    if (sessao) return sessao;
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}
