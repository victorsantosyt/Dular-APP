export function mapStatus(status: string): string {
  const map: Record<string, string> = {
    SOLICITADO: "pendente",
    PENDENTE: "pendente",
    ACEITO: "aceita",
    CONFIRMADO: "confirmado",
    EM_ANDAMENTO: "andamento",
    CONCLUIDO: "concluida",
    FINALIZADO: "finalizado",
    CANCELADO: "cancelada",
  };
  return map[status] ?? status.toLowerCase();
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return "--";
  const date = new Date(dateStr);
  const hoje = new Date();
  if (date.toDateString() === hoje.toDateString()) return "Hoje";
  const amanha = new Date(hoje);
  amanha.setDate(hoje.getDate() + 1);
  if (date.toDateString() === amanha.toDateString()) return "Amanhã";
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
