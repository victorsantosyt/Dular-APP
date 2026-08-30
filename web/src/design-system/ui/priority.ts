import type { Tone } from "./Badge";

/**
 * Fonte única da escala de prioridade do painel. Todas as telas de
 * Segurança (Risk score, Check-ins, Verificações, Incidentes) leem daqui —
 * sem isso cada tela inventa a própria cor para o mesmo estado.
 *
 * Escala: CRITICA > ALTA > MEDIA > BAIXA
 *   vermelho  >  laranja  >  âmbar  >  azul
 */

/** IncidenteGravidade (BAIXA/MEDIA/ALTA/CRITICA) e IncidentSeverity (BAIXA/MEDIA/ALTA). */
export function gravidadeTone(valor: string | null | undefined): Tone {
  switch ((valor ?? "").toUpperCase()) {
    case "CRITICA":
      return "critical";
    case "ALTA":
      return "high";
    case "MEDIA":
      return "medium";
    case "BAIXA":
      return "low";
    default:
      return "neutral";
  }
}

/** IncidentStatus (ABERTO/EM_ANALISE/CONFIRMADO/ENCERRADO). */
export function incidenteStatusTone(valor: string | null | undefined): Tone {
  switch ((valor ?? "").toUpperCase()) {
    case "ABERTO":
      return "high"; // aguardando triagem — exige ação
    case "EM_ANALISE":
      return "info";
    case "CONFIRMADO":
      return "critical"; // denúncia procedente
    case "ENCERRADO":
      return "success";
    default:
      return "neutral";
  }
}

/** VerificacaoStatus (PENDENTE/VERIFICADO/REPROVADO). */
export function verificacaoTone(valor: string | null | undefined): Tone {
  switch ((valor ?? "").toUpperCase()) {
    case "PENDENTE":
      return "medium"; // fila de KYC — prioridade operacional
    case "VERIFICADO":
    case "APPROVED":
      return "success";
    case "REPROVADO":
    case "REJECTED":
      return "critical";
    default:
      return "neutral";
  }
}

/** SafetyEventType (SOS_SILENT/CHECKIN_OK) — SOS é o topo da escala. */
export function eventoSegurancaTone(tipo: string | null | undefined): Tone {
  return (tipo ?? "").toUpperCase().includes("SOS") ? "critical" : "success";
}

/** Rótulo legível: os enums vêm em CAIXA_ALTA com underscore. */
export function rotuloEnum(valor: string | null | undefined): string {
  if (!valor) return "—";
  return valor.replace(/_/g, " ");
}
