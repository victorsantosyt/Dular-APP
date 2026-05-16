import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { assertRole, assertStatus } from "@/lib/regrasServico";
import { ServicoStatus, UserRole } from "@prisma/client";
import { registrarEvento } from "@/lib/servicoEvento";
import { sendPushNotification } from "@/lib/notifications";
import { recusarServicoSchema } from "@/lib/schemas/servicos";
import { isMotivoGrave, normalizarMotivo, registrarMotivoGrave } from "@/lib/safetyMotivo";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const auth = requireAuth(req);
    assertRole(auth.role as UserRole, ["DIARISTA", "MONTADOR"]);

    const { id } = await params;

    const body = await req.json().catch(() => ({}));
    const parsed = recusarServicoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Motivo obrigatório." },
        { status: 400 },
      );
    }
    const { motivo, observacao } = parsed.data;

    const servico = await prisma.servico.findUnique({ where: { id } });
    if (!servico) return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });

    const isDiarista = servico.diaristaId === auth.userId;
    const isMontador = servico.montadorId === auth.userId;
    if (!isDiarista && !isMontador) {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
    }

    assertStatus(servico.status as ServicoStatus, ["SOLICITADO"]);

    const motivoTag = normalizarMotivo(motivo);
    const motivoGrave = isMotivoGrave(motivoTag);
    // Annotation textual em `Servico.observacoes` é preservada por
    // compatibilidade (UI legada ainda lê a string). A fonte da verdade,
    // porém, passa a ser `ServicoEvento.{motivo, observacao, motivoGrave}`.
    const annotation = `\n[RECUSADO por ${auth.role}] motivo=${motivoTag ?? motivo}${observacao ? ` obs=${observacao}` : ""}`;
    const novasObs = `${servico.observacoes ?? ""}${annotation}`.trim();

    const updated = await prisma.servico.update({
      where: { id },
      data: { status: "RECUSADO", observacoes: novasObs },
    });

    await registrarEvento(
      servico.id,
      servico.status as ServicoStatus,
      "RECUSADO",
      auth.role as UserRole,
      auth.userId,
      {
        motivo: motivoTag ?? motivo ?? null,
        observacao: observacao ?? null,
        motivoGrave,
      },
    );

    if (motivoGrave) {
      await registrarMotivoGrave({
        servicoId: servico.id,
        motivo: motivoTag,
        observacao: observacao ?? null,
        reporterId: auth.userId,
        reportedUserId: servico.clientId,
        acao: "RECUSADO",
      });
    }

    await sendPushNotification(
      servico.clientId,
      "Solicitação recusada",
      "O profissional não pôde atender seu pedido. Procure outro profissional.",
      { servicoId: servico.id, tipo: "SERVICO_RECUSADO", motivo: motivoTag ?? "outro" },
    );

    return NextResponse.json({ ok: true, servico: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro";
    const code = msg === "FORBIDDEN" ? 403 : msg === "INVALID_STATUS" ? 409 : 500;
    if (msg === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: code });
  }
}
