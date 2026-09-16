import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
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
 *  - Cria um `SafetyEvent` do tipo `SOS_SILENT` apontando para o serviço.
 *  - Abre um `IncidentReport` para revisão do admin. NÃO mexe no score: a
 *    alegação é da contraparte e ninguém a verificou. O evento de score só
 *    nasce quando o admin confirma a denúncia em admin/incidentes/[id]/resolver.
 *
 * Antes, este fluxo aplicava DENUNCIA_CONFIRMADA (gravidade ALTA, −150) direto
 * nos dois ledgers: três cancelamentos com motivo grave suspendiam a conta sem
 * que ninguém tivesse olhado.
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
        status: "ACIONADO",
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
      await abrirIncidenteDeMotivoGrave({ servicoId, motivo, observacao, reporterId, reportedUserId, acao });
    } catch (err) {
      console.error("[safetyMotivo] falha ao abrir incidente para revisão", err);
    }
  }
}

export type ResultadoIncidenteMotivoGrave = {
  status: "criado" | "ja_aberto";
  incidenteId: string;
};

/**
 * Um incidente por par (serviço, denunciado). Se já existe um ainda não
 * resolvido para o par — ABERTO ou EM_ANALISE —, devolve esse em vez de abrir
 * outro: repetir o motivo não pode virar duas denúncias contra a mesma pessoa.
 */
export async function abrirIncidenteDeMotivoGrave(p: {
  servicoId: string;
  motivo: MotivoCancelamento;
  observacao?: string | null;
  reporterId: string;
  reportedUserId: string;
  acao: "RECUSADO" | "CANCELADO";
}): Promise<ResultadoIncidenteMotivoGrave> {
  const aberto = await prisma.incidentReport.findFirst({
    where: {
      serviceId: p.servicoId,
      reportedUserId: p.reportedUserId,
      status: { in: ["ABERTO", "EM_ANALISE"] },
    },
    select: { id: true },
  });
  if (aberto) return { status: "ja_aberto", incidenteId: aberto.id };

  const verbo = p.acao === "CANCELADO" ? "cancelar" : "recusar";
  const incidente = await prisma.incidentReport.create({
    data: {
      reportedById: p.reporterId,
      reportedUserId: p.reportedUserId,
      serviceId: p.servicoId,
      type: "OUTRO",
      severity: "ALTA",
      categoria: "OUTRO",
      subtipo: p.motivo,
      gravidade: "ALTA",
      status: "ABERTO",
      description:
        `Motivo grave informado ao ${verbo} o serviço: ${p.motivo}.` +
        (p.observacao ? `\nObservação: ${p.observacao}` : ""),
    },
    select: { id: true },
  });
  return { status: "criado", incidenteId: incidente.id };
}
