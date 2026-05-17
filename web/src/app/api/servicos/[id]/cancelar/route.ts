import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { cancelarServicoSchema } from "@/lib/schemas/servicos";
import { assertStatus, isCancelamentoTardio } from "@/lib/regrasServico";
import { ServicoStatus } from "@prisma/client";
import { registrarEvento } from "@/lib/servicoEvento";
import { criarNotificacao } from "@/lib/notifications";
import { aplicarEvento } from "@/lib/safeScore";
import { isMotivoGrave, normalizarMotivo, registrarMotivoGrave } from "@/lib/safetyMotivo";

type Params = { params: Promise<{ id: string }> };

// Status nos quais ainda é possível cancelar. Inclui estados pós-aceite
// para permitir cancelamento durante a execução (com motivo).
const STATUS_CANCELAVEIS: ServicoStatus[] = [
  "SOLICITADO",
  "ACEITO",
  "EM_ANDAMENTO",
  "AGUARDANDO_FINALIZACAO",
];

export async function POST(req: Request, { params }: Params) {
  try {
    const auth = requireAuth(req);
    const { id } = await params;

    const body = await req.json().catch(() => ({}));
    const parsed = cancelarServicoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Motivo obrigatório." },
        { status: 400 },
      );
    }
    const { motivo, observacao } = parsed.data;

    const servico = await prisma.servico.findUnique({ where: { id } });
    if (!servico) return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });

    const isCliente = servico.clientId === auth.userId;
    const isDiarista = servico.diaristaId === auth.userId;
    const isMontador = servico.montadorId === auth.userId;
    const isProfissional = isDiarista || isMontador;

    if (!isCliente && !isProfissional && auth.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
    }

    assertStatus(servico.status as ServicoStatus, STATUS_CANCELAVEIS);

    const tardio = isCancelamentoTardio(servico.data);
    const tardioTag = tardio ? "TARDIO" : "OK";
    const motivoTag = normalizarMotivo(motivo);
    const motivoGrave = isMotivoGrave(motivoTag);
    // Annotation textual em `Servico.observacoes` é preservada por
    // compatibilidade (UI legada ainda lê a string). A fonte da verdade,
    // porém, passa a ser `ServicoEvento.{motivo, observacao, motivoGrave}`.
    const annotation = `\n[CANCELADO ${tardioTag} por ${auth.role}] motivo=${motivoTag ?? motivo}${observacao ? ` obs=${observacao}` : ""}`;
    const novasObs = `${servico.observacoes ?? ""}${annotation}`.trim();

    const updated = await prisma.servico.update({
      where: { id },
      data: {
        status: "CANCELADO",
        observacoes: novasObs,
      },
    });

    await registrarEvento(
      servico.id,
      servico.status as ServicoStatus,
      "CANCELADO",
      auth.role,
      auth.userId,
      {
        motivo: motivoTag ?? motivo ?? null,
        observacao: observacao ?? null,
        motivoGrave,
      },
    );

    await aplicarEvento(auth.userId, "CANCELAMENTO", id).catch(() => null);

    if (motivoGrave) {
      const profissionalId = servico.montadorId ?? servico.diaristaId;
      const reportedUserId = isCliente ? profissionalId : servico.clientId;
      await registrarMotivoGrave({
        servicoId: servico.id,
        motivo: motivoTag,
        observacao: observacao ?? null,
        reporterId: auth.userId,
        reportedUserId: reportedUserId ?? null,
        acao: "CANCELADO",
      });
    }

    const profissionalIdFinal = servico.montadorId ?? servico.diaristaId;
    const destinoId = isCliente ? profissionalIdFinal : servico.clientId;
    if (destinoId) {
      await criarNotificacao({
        userId: destinoId,
        type: "SERVICO_CANCELADO",
        title: "Serviço cancelado",
        body: isCliente
          ? "O empregador cancelou a solicitação."
          : isMontador
            ? "O montador cancelou o serviço."
            : "A diarista cancelou o serviço.",
        servicoId: servico.id,
        pushData: {
          type: "SERVICO_CANCELADO",
          servicoId: servico.id,
          tardio,
          motivo: motivoTag ?? "outro",
        },
      });
    }

    return NextResponse.json({ ok: true, tardio, motivo: motivoTag ?? "outro", servico: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro";
    const code = msg === "INVALID_STATUS" ? 409 : 500;
    if (msg === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: code });
  }
}
