import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { aplicarEvento } from "@/lib/safeScore";
import { applyEvent } from "@/lib/safeScore/applyEvent";
import { MOTIVOS_GRAVES, type MotivoCancelamento } from "@/lib/schemas/servicos";

/**
 * Normaliza um motivo livre vindo da rede para uma das tags canônicas.
 * Caso a string não case com nenhuma tag, devolve `null` (motivo "outro"
 * implícito, sem ação de segurança).
 */
export function normalizarMotivo(motivo: string | null | undefined): MotivoCancelamento | null {
  if (!motivo || typeof motivo !== "string") return null;
  const lower = motivo.trim().toLowerCase();

  if (lower === "indisponibilidade") return "indisponibilidade";
  if (lower === "endereco_incompativel" || lower === "endereço_incompatível") {
    return "endereco_incompativel";
  }
  if (lower === "comportamento_inadequado" || lower === "comportamento inadequado") {
    return "comportamento_inadequado";
  }
  if (lower === "problema_seguranca" || lower === "problema de segurança" || lower === "problema_segurança") {
    return "problema_seguranca";
  }
  if (lower === "outro") return "outro";
  return null;
}

export function isMotivoGrave(motivo: MotivoCancelamento | null): motivo is MotivoCancelamento {
  return !!motivo && (MOTIVOS_GRAVES as readonly string[]).includes(motivo);
}

/**
 * Dispara as anotações de segurança quando o motivo é grave
 * (comportamento_inadequado / problema_seguranca).
 *
 *  - Cria um `SafetyEvent` do tipo `SOS_SILENT` apontando para o serviço
 *    (reusa a enum existente; não introduzimos novo tipo nesta task).
 *  - Aplica um `SafeScoreEvent` negativo via `applyEvent` para registrar o
 *    impacto no ledger novo.
 *
 * Falhas aqui são logadas mas nunca quebram o fluxo principal.
 */
export async function registrarMotivoGrave(params: {
  servicoId: string;
  motivo: MotivoCancelamento;
  observacao?: string | null;
  reporterId: string;
  reportedUserId: string | null;
  acao: "RECUSADO" | "CANCELADO";
}) {
  const { servicoId, motivo, observacao, reporterId, reportedUserId, acao } = params;

  try {
    await prisma.safetyEvent.create({
      data: {
        type: "SOS_SILENT",
        userId: reporterId,
        serviceId: servicoId,
        meta: {
          motivo,
          observacao: observacao ?? null,
          acao,
          reportedUserId: reportedUserId ?? null,
        } as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.error("[safetyMotivo] falha ao criar SafetyEvent", err);
  }

  if (reportedUserId) {
    try {
      const idempotencyKey = `motivo:${motivo}:${servicoId}:${reportedUserId}`;
      await applyEvent({
        userId: reportedUserId,
        eventType: motivo === "problema_seguranca"
          ? "motivo_problema_seguranca"
          : "motivo_comportamento_inadequado",
        source: "ServicoMotivo",
        sourceId: servicoId,
        idempotencyKey,
        payload: {
          motivo,
          observacao: observacao ?? null,
          acao,
          reporterId,
        },
      });
    } catch (err) {
      console.error("[safetyMotivo] falha ao aplicar SafeScoreEvent", err);
    }

    try {
      await aplicarEvento(reportedUserId, "DENUNCIA_CONFIRMADA", servicoId, `motivo=${motivo} gravidade=ALTA`);
    } catch (err) {
      console.error("[safetyMotivo] falha ao aplicar safeScore legado", err);
    }
  }
}
