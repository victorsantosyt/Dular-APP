import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { requireAuthAtivo, respostaDeSessao } from "@/lib/contaAtiva";
import { assertStatus } from "@/lib/regrasServico";
import { ServicoStatus } from "@prisma/client";
import { registrarEvento } from "@/lib/servicoEvento";
import { aplicarEventoNaTransacao } from "@/lib/safeScore";
import { criarNotificacao } from "@/lib/notifications";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const auth = await requireAuthAtivo(req);
    if (auth.role !== "EMPREGADOR") {
      return NextResponse.json({ ok: false, error: "Apenas empregador pode confirmar." }, { status: 403 });
    }

    const { id } = await params;
    const servico = await prisma.servico.findUnique({ where: { id } });
    if (!servico) return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });

    if (servico.clientId !== auth.userId) {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
    }

    assertStatus(servico.status as ServicoStatus, ["CONCLUIDO"]);

    const profissionalId = servico.montadorId ?? servico.diaristaId;

    // Status e score na MESMA transação. Antes o status virava CONFIRMADO e só
    // depois os eventos eram gravados: uma falha no score deixava o serviço
    // confirmado, sem evento, e sem retentativa possível (a rota exige
    // CONCLUIDO). Agora a falha reverte o status junto.
    //
    // CAS no status: duas confirmações simultâneas não passam as duas — a
    // segunda espera a trava da linha e já encontra CONFIRMADO.
    const updated = await prisma.$transaction(async (tx) => {
      const cas = await tx.servico.updateMany({
        where: { id, status: "CONCLUIDO" },
        data: { status: "CONFIRMADO" },
      });
      if (cas.count === 0) throw new Error("INVALID_STATUS");

      await aplicarEventoNaTransacao(tx, servico.clientId, "SERVICO_CONCLUIDO", servico.id, "Serviço confirmado pelo empregador.");
      if (profissionalId) {
        await aplicarEventoNaTransacao(tx, profissionalId, "SERVICO_CONCLUIDO", servico.id, "Serviço confirmado pelo empregador.");
      }

      return tx.servico.findUniqueOrThrow({ where: { id } });
    });

    await registrarEvento(servico.id, servico.status as ServicoStatus, "CONFIRMADO", auth.role, auth.userId);

    if (profissionalId) {
      await criarNotificacao({
        userId: profissionalId,
        type: "SERVICO_CONFIRMADO",
        title: "Serviço confirmado",
        body: "O empregador confirmou a conclusão do serviço.",
        servicoId: servico.id,
      });
    }

    return NextResponse.json({ ok: true, servico: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro";
    const code = msg === "INVALID_STATUS" ? 409 : 500;
    const sessao = respostaDeSessao(error);
    if (sessao) return sessao;
    return NextResponse.json({ ok: false, error: msg }, { status: code });
  }
}
