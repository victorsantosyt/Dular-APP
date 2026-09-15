import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAuth";
import { getRequestIp } from "@/lib/requestIp";
import { SOS_STATUS, statusDoSos } from "@/lib/sosPainel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const statusSchema = z.enum(SOS_STATUS as [string, ...string[]]);

const bodySchema = z.object({
  status: statusSchema,
  /** O status que o admin estava vendo na tela quando clicou. */
  statusAnterior: statusSchema,
});

/**
 * PATCH /api/admin/seguranca/sos/[id]/status — o admin muda o andamento de um SOS.
 *
 * - Exige ADMIN conferido no banco (requireAdmin), não só o papel do token.
 * - Só SOS_SILENT: id de check-in ou inexistente é 404.
 * - A escrita exige o status que o admin viu (`statusAnterior`). Tela
 *   desatualizada, ou dois admins mudando o mesmo SOS ao mesmo tempo: quem
 *   perde recebe 409 com o status atual, em vez de sobrescrever a decisão do
 *   outro.
 * - Cada mudança vai para o AuditLog na mesma transação.
 * - Status nulo é SOS anterior à coluna existir e conta como ACIONADO.
 */
export async function PATCH(req: Request, { params }: Params) {
  let adminId: string;
  try {
    adminId = (await requireAdmin(req)).userId;
  } catch (e) {
    const semPermissao = e instanceof Error && e.message === "Forbidden";
    return NextResponse.json(
      { ok: false, error: semPermissao ? "Acesso negado." : "Não autorizado." },
      { status: semPermissao ? 403 : 401 },
    );
  }

  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Status inválido." }, { status: 400 });
  }
  const novo = parsed.data.status as (typeof SOS_STATUS)[number];
  const anterior = parsed.data.statusAnterior as (typeof SOS_STATUS)[number];

  try {
    const sos = await prisma.safetyEvent.findUnique({ where: { id }, select: { type: true, status: true } });
    if (!sos || sos.type !== "SOS_SILENT") {
      return NextResponse.json({ ok: false, error: "SOS não encontrado." }, { status: 404 });
    }

    const atual = statusDoSos(sos.status);
    if (atual !== anterior) {
      return conflito(atual);
    }
    if (atual === novo) {
      return NextResponse.json({ ok: true, alterado: false, status: atual });
    }

    const alterou = await prisma.$transaction(async (tx) => {
      const { count } = await tx.safetyEvent.updateMany({
        where: {
          id,
          type: "SOS_SILENT",
          // ACIONADO também cobre o SOS anterior à coluna (status nulo).
          ...(anterior === "ACIONADO"
            ? { OR: [{ status: null }, { status: "ACIONADO" }] }
            : { status: anterior }),
        },
        data: { status: novo, statusAtualizadoEm: new Date(), statusAtualizadoPorId: adminId },
      });
      if (count !== 1) return false;

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          targetId: id,
          targetType: "SafetyEvent",
          action: "SOS_STATUS_ALTERADO",
          before: { status: anterior },
          after: { status: novo },
          ip: getRequestIp(req),
          userAgent: req.headers.get("user-agent"),
        },
      });
      return true;
    });

    if (!alterou) {
      const agora = await prisma.safetyEvent.findUnique({ where: { id }, select: { status: true } });
      return conflito(statusDoSos(agora?.status));
    }
    return NextResponse.json({ ok: true, alterado: true, status: novo });
  } catch (err) {
    console.error("[admin/seguranca/sos/status] erro inesperado", { id, err });
    return NextResponse.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}

function conflito(statusAtual: string) {
  return NextResponse.json(
    {
      ok: false,
      error: "Este SOS mudou de status desde que a página foi carregada. Recarregue para ver o atual.",
      statusAtual,
    },
    { status: 409 },
  );
}
