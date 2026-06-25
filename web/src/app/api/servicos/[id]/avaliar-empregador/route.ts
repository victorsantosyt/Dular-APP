import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { avaliarServicoSchema } from "@/lib/schemas/servicos";
import { assertStatus } from "@/lib/regrasServico";
import { ServicoStatus } from "@prisma/client";
import { aplicarEvento } from "@/lib/safeScore";

type Params = { params: Promise<{ id: string }> };

/**
 * Avaliação na direção inversa: o profissional (DIARISTA/MONTADOR) avalia o
 * EMPREGADOR. Espelha o contrato de `/avaliar` (mesmo `avaliarServicoSchema`,
 * mesmo `aplicarEvento`), mas:
 *  - autoriza apenas o profissional vinculado ao serviço;
 *  - grava em `AvaliacaoEmpregador` (não colide com `Servico.avaliacao`);
 *  - NÃO altera o status — a transição CONFIRMADO → FINALIZADO continua
 *    sendo exclusiva do fluxo do empregador (`/avaliar`).
 * O "score do empregador" recomputado é o SafeScore (via `aplicarEvento`),
 * que é o score efetivamente exibido ao profissional na tela de detalhe.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "DIARISTA" && auth.role !== "MONTADOR") {
      return NextResponse.json(
        { ok: false, error: "Apenas o profissional pode avaliar o empregador." },
        { status: 403 },
      );
    }

    const { id } = await params;

    const body = await req.json();
    const parsed = avaliarServicoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
    }

    const servico = await prisma.servico.findUnique({
      where: { id },
      include: { avaliacaoEmpregador: true },
    });
    if (!servico) return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });

    const profissionalId = servico.montadorId ?? servico.diaristaId;
    if (!profissionalId || profissionalId !== auth.userId) {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
    }

    if (servico.avaliacaoEmpregador) {
      return NextResponse.json({ ok: false, error: "Empregador já avaliado." }, { status: 409 });
    }

    // CONFIRMADO libera a avaliação; FINALIZADO é aceito porque o empregador
    // pode ter avaliado antes (CONFIRMADO → FINALIZADO) e o profissional ainda
    // não — não queremos perder a janela de avaliação dele.
    assertStatus(servico.status as ServicoStatus, ["CONFIRMADO", "FINALIZADO"]);

    const avaliacao = await prisma.avaliacaoEmpregador.create({
      data: {
        servicoId: servico.id,
        profissionalId: auth.userId,
        empregadorId: servico.clientId,
        ...parsed.data,
      },
    });

    // Recomputa o score do empregador. `calcularPeso` não encontra este id na
    // tabela `Avaliacao` e cai no fallback `nota=` da descrição (comportamento
    // já previsto em safeScore.ts).
    await aplicarEvento(
      servico.clientId,
      parsed.data.notaGeral >= 4 ? "AVALIACAO_POSITIVA" : "AVALIACAO_NEGATIVA",
      avaliacao.id,
      `nota=${parsed.data.notaGeral}`,
    );

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro";
    const code = msg === "INVALID_STATUS" ? 409 : 500;
    if (msg === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: code });
  }
}
