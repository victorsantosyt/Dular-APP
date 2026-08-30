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

/**
 * ServicoStatus em português legível. Enum cru (CAIXA_ALTA, underscore) é
 * detalhe de banco — não deve vazar para a interface.
 */
const SERVICO_STATUS_LABEL: Record<string, string> = {
  RASCUNHO: "Rascunho",
  SOLICITADO: "Solicitado",
  ACEITO: "Aceito",
  RECUSADO: "Recusado",
  CANCELADO: "Cancelado",
  EM_ANDAMENTO: "Em andamento",
  AGUARDANDO_FINALIZACAO: "Aguardando finalização",
  CONCLUIDO: "Concluído",
  CONFIRMADO: "Confirmado",
  FINALIZADO: "Finalizado",
};

export function servicoStatusLabel(valor: string | null | undefined): string {
  if (!valor) return "—";
  const chave = valor.toUpperCase();
  return SERVICO_STATUS_LABEL[chave] ?? rotuloEnum(chave);
}

/** Cor do status no ciclo de vida do serviço. */
export function servicoStatusTone(valor: string | null | undefined): Tone {
  switch ((valor ?? "").toUpperCase()) {
    case "FINALIZADO":
    case "CONFIRMADO":
      return "success";
    case "CONCLUIDO":
      return "low";
    case "EM_ANDAMENTO":
    case "AGUARDANDO_FINALIZACAO":
      return "info";
    case "SOLICITADO":
    case "ACEITO":
      return "medium";
    case "CANCELADO":
    case "RECUSADO":
      return "critical";
    default:
      return "neutral";
  }
}
