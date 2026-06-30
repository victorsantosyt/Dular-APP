import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { assertRole } from "@/lib/regrasServico";
import { UserRole } from "@prisma/client";
import { criarNotificacao } from "@/lib/notifications";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// Estados em que faz sentido remarcar (serviço ativo, ainda não encerrado).
const REAGENDAVEL = new Set(["ACEITO", "CONFIRMADO", "EM_ANDAMENTO"]);

const proporSchema = z.object({
  data: z.string().datetime({ offset: true }),
  turno: z.enum(["MANHA", "TARDE"]),
});

const decisaoSchema = z.object({
  aceitar: z.boolean(),
});

/** POST — o profissional (diarista/montador) propõe nova data/turno. */
export async function POST(req: Request, { params }: Params) {
  try {
    const auth = requireAuth(req);
    assertRole(auth.role as UserRole, ["DIARISTA", "MONTADOR"]);

    const { id } = await params;
    const parsed = proporSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Informe a nova data e o turno." }, { status: 400 });
    }
    const novaData = new Date(parsed.data.data);
    if (Number.isNaN(novaData.getTime())) {
      return NextResponse.json({ ok: false, error: "Data inválida." }, { status: 400 });
    }

    const servico = await prisma.servico.findUnique({ where: { id } });
    if (!servico) return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });

    const isProvider = servico.diaristaId === auth.userId || servico.montadorId === auth.userId;
    if (!isProvider) {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
    }
    if (!REAGENDAVEL.has(servico.status)) {
      return NextResponse.json(
        { ok: false, error: "Este serviço não pode ser reagendado neste estado.", statusAtual: servico.status },
        { status: 409 },
      );
    }

    const updated = await prisma.servico.update({
      where: { id },
      data: {
        reagendamentoData: novaData,
        reagendamentoTurno: parsed.data.turno,
        reagendamentoPor: auth.userId,
        reagendamentoEm: new Date(),
      },
    });

    await criarNotificacao({
      userId: servico.clientId,
      type: "SERVICO_REAGENDAMENTO_PROPOSTO",
      title: "Proposta de reagendamento",
      body: "O profissional propôs uma nova data para o serviço. Confirme ou recuse.",
      servicoId: servico.id,
    });

    return NextResponse.json({ ok: true, servico: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro";
    if (msg === "Unauthorized") return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    const code = msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status: code });
  }
}

/** PATCH — o empregador (client) confirma ou recusa a proposta pendente. */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const auth = requireAuth(req);
    assertRole(auth.role as UserRole, ["EMPREGADOR"]);

    const { id } = await params;
    const parsed = decisaoSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Decisão inválida." }, { status: 400 });
    }

    const servico = await prisma.servico.findUnique({ where: { id } });
    if (!servico) return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });
    if (servico.clientId !== auth.userId) {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
    }
    if (!servico.reagendamentoData || !servico.reagendamentoTurno) {
      return NextResponse.json({ ok: false, error: "Não há reagendamento pendente." }, { status: 409 });
    }

    const proposerId = servico.reagendamentoPor;
    const updated = await prisma.servico.update({
      where: { id },
      data: parsed.data.aceitar
        ? {
            data: servico.reagendamentoData,
            turno: servico.reagendamentoTurno,
            reagendamentoData: null,
            reagendamentoTurno: null,
            reagendamentoPor: null,
            reagendamentoEm: null,
          }
        : {
            reagendamentoData: null,
            reagendamentoTurno: null,
            reagendamentoPor: null,
            reagendamentoEm: null,
          },
    });

    if (proposerId) {
      await criarNotificacao({
        userId: proposerId,
        type: parsed.data.aceitar ? "SERVICO_REAGENDAMENTO_CONFIRMADO" : "SERVICO_REAGENDAMENTO_RECUSADO",
        title: parsed.data.aceitar ? "Reagendamento confirmado" : "Reagendamento recusado",
        body: parsed.data.aceitar
          ? "O empregador confirmou a nova data do serviço."
          : "O empregador recusou a nova data proposta.",
        servicoId: servico.id,
      });
    }

    return NextResponse.json({ ok: true, servico: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro";
    if (msg === "Unauthorized") return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    const code = msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status: code });
  }
}
