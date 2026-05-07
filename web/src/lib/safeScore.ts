import { prisma } from "@/lib/prisma";
import type { IncidenteGravidade, SafeScore, ScoreEventoTipo } from "@prisma/client";
import { applyEvent } from "@/lib/safeScore/applyEvent";

const SCORE_INICIAL = 500;

const PESOS_FIXOS: Partial<Record<ScoreEventoTipo, number>> = {
  SERVICO_CONCLUIDO: 5,
  KYC_APROVADO: 50,
  DENUNCIA_ARQUIVADA: 10,
  CANCELAMENTO: -15,
  NO_SHOW: -25,
  TEMPO_PLATAFORMA: 3,
};

const PESO_DENUNCIA_CONFIRMADA: Record<IncidenteGravidade, number> = {
  BAIXA: -30,
  MEDIA: -80,
  ALTA: -150,
  CRITICA: -300,
};

function clampScore(score: number) {
  return Math.max(0, Math.min(1000, score));
}

function pesoAvaliacao(nota: number, tipo: ScoreEventoTipo) {
  if (tipo === "AVALIACAO_POSITIVA") {
    if (nota >= 5) return 15;
    if (nota >= 4) return 8;
    return 0;
  }
  if (nota <= 1) return -20;
  if (nota <= 2) return -10;
  return 0;
}

async function calcularPeso(
  tipo: ScoreEventoTipo,
  referenciaId?: string,
  descricao?: string,
) {
  if (tipo === "AVALIACAO_POSITIVA" || tipo === "AVALIACAO_NEGATIVA") {
    const avaliacao = referenciaId
      ? await prisma.avaliacao.findUnique({
          where: { id: referenciaId },
          select: { notaGeral: true },
        })
      : null;
    const notaFromDescricao = descricao?.match(/nota=(\d+)/)?.[1];
    const nota = avaliacao?.notaGeral ?? Number(notaFromDescricao);
    return pesoAvaliacao(Number.isFinite(nota) ? nota : 0, tipo);
  }

  if (tipo === "DENUNCIA_CONFIRMADA") {
    const incidente = referenciaId
      ? await prisma.incidentReport.findUnique({
          where: { id: referenciaId },
          select: { gravidade: true },
        })
      : null;
    const gravidade =
      incidente?.gravidade ??
      (descricao?.match(/gravidade=(\w+)/)?.[1] as IncidenteGravidade | undefined);
    return PESO_DENUNCIA_CONFIRMADA[gravidade ?? "MEDIA"];
  }

  return PESOS_FIXOS[tipo] ?? 0;
}

export async function suspenderUsuario(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { status: "BLOQUEADO", emObservacao: true },
  });
}

// Mapeia tipos legados para o novo ledger
function mapTipoToEventType(tipo: ScoreEventoTipo): string {
  const map: Partial<Record<ScoreEventoTipo, string>> = {
    AVALIACAO_POSITIVA: "avaliacao_positiva",
    AVALIACAO_NEGATIVA: "avaliacao_negativa",
    SERVICO_CONCLUIDO: "servico_concluido",
    CANCELAMENTO: "cancelamento_tardio",
    DENUNCIA_CONFIRMADA: "incidente_resolvido_favor",
    DENUNCIA_ARQUIVADA: "incidente_arquivado",
    KYC_APROVADO: "kyc_aprovado",
    NO_SHOW: "cancelamento_tardio",
    TEMPO_PLATAFORMA: "servico_concluido",
  };
  return map[tipo] ?? tipo.toLowerCase();
}

export async function aplicarEvento(
  userId: string,
  tipo: ScoreEventoTipo,
  referenciaId?: string,
  descricao?: string,
): Promise<SafeScore> {
  const peso = await calcularPeso(tipo, referenciaId, descricao);

  // ── LEGADO: mantém gravação original intacta ──────────────────────────
  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.safeScore.upsert({
      where: { userId },
      create: { userId, score: SCORE_INICIAL },
      update: {},
    });

    const score = clampScore(current.score + peso);

    const safeScore = await tx.safeScore.update({
      where: { id: current.id },
      data: { score },
    });

    await tx.scoreEvento.create({
      data: { safeScoreId: current.id, tipo, peso, referenciaId, descricao },
    });

    if (score < 400) {
      await tx.user.update({
        where: { id: userId },
        data: { emObservacao: true },
      });
    }

    return safeScore;
  });

  if (updated.score < 200) {
    await suspenderUsuario(userId);
  }
  // ── FIM LEGADO ────────────────────────────────────────────────────────

  // ── NOVO LEDGER: dual-write silencioso ───────────────────────────────
  // Falha aqui nunca quebra o fluxo principal
  try {
    const idempotencyKey = `${userId}:${tipo}:${referenciaId ?? "noref"}:${Date.now()}`;
    await applyEvent({
      userId,
      eventType: mapTipoToEventType(tipo),
      source: tipo,
      sourceId: referenciaId,
      idempotencyKey,
      payload: descricao ? { descricao } : undefined,
    });
  } catch (err) {
    console.error("[SafeScore:dual-write] falha silenciosa:", err);
  }
  // ── FIM NOVO LEDGER ───────────────────────────────────────────────────

  return updated;
}

export function getFaixa(score: number): {
  label: string;
  cor: string;
  bloqueado: boolean;
} {
  if (score >= 800) return { label: "Confiança Máxima", cor: "#22c55e", bloqueado: false };
  if (score >= 600) return { label: "Confiável", cor: "#3b82f6", bloqueado: false };
  if (score >= 400) return { label: "Em Observação", cor: "#f59e0b", bloqueado: false };
  if (score >= 200) return { label: "Risco Alto", cor: "#ef4444", bloqueado: true };
  return { label: "Suspenso", cor: "#7f1d1d", bloqueado: true };
}
