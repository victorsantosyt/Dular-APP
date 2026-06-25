export function mapStatus(status: string): string {
  const map: Record<string, string> = {
    SOLICITADO: "pendente",
    PENDENTE: "pendente",
    ACEITO: "aceita",
    CONFIRMADO: "confirmado",
    EM_ANDAMENTO: "andamento",
    // Sem esta entrada o status caía no fallback e virava "pendente" no mapa do
    // hook → o card exibia "Aceitar" depois de finalizado (bug). Agora é um
    // estado próprio de espera (sem ação).
    AGUARDANDO_FINALIZACAO: "aguardando",
    CONCLUIDO: "concluida",
    FINALIZADO: "finalizado",
    CANCELADO: "cancelada",
  };
  return map[status] ?? status.toLowerCase();
}

/**
 * A data do serviço é gravada como meia-noite UTC ("2026-06-24T00:00:00Z").
 * Exibi-la com `new Date(...)` em fuso negativo (Brasil, UTC-3) desliza o dia
 * (mostra o anterior/seguinte). Este helper lê os componentes em UTC e remonta
 * no dia de calendário LOCAL correto. Retorna null se inválida.
 *
 * Use SOMENTE para datas-só (data agendada do serviço). NÃO use para instantes
 * reais (createdAt, finalizadoEm) — esses devem manter o horário local.
 */
export function parseDataServico(value?: string | number | Date | null): Date | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
}

export function formatDate(dateStr?: string): string {
  const date = parseDataServico(dateStr);
  if (!date) return "--";
  const agora = new Date();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const diffDays = Math.round((date.getTime() - hoje.getTime()) / 86_400_000);
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Amanhã";
  return date.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

const TURNO_LABEL: Record<string, string> = {
  MANHA: "Manhã",
  TARDE: "Tarde",
  NOITE: "Noite",
  INTEGRAL: "Integral",
};

export function formatHora(turno?: string): string {
  if (!turno) return "--";
  return TURNO_LABEL[turno] ?? turno;
}

export function formatCurrency(value?: number): string {
  if (!value) return "--";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
