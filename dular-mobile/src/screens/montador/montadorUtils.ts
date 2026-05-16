import type { MontadorServico } from "@/api/montadorApi";

export function upperStatus(value: unknown) {
  return String(value ?? "").toUpperCase();
}

export function isSolicitacaoPendente(servico: MontadorServico) {
  const status = upperStatus(servico.status);
  return status === "PENDENTE" || status === "SOLICITADO";
}

export function isServicoNaAgenda(servico: MontadorServico) {
  const status = upperStatus(servico.status);
  return ["ACEITO", "CONFIRMADO", "EM_ANDAMENTO", "FINALIZADO", "CONCLUIDO"].includes(status);
}

export function canOpenChat(servico: MontadorServico) {
  const status = upperStatus(servico.status);
  return ["ACEITO", "CONFIRMADO", "EM_ANDAMENTO", "FINALIZADO", "CONCLUIDO"].includes(status);
}

export function firstName(value?: string | null, fallback = "Montador") {
  return (value || "").trim().split(/\s+/)[0] || fallback;
}

export function formatMoneyFromCents(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "A combinar";
  return (value / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function labelServico(servico: MontadorServico) {
  const raw = servico.tipoServico ?? servico.tipo ?? "Serviço";
  return String(raw).replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function labelSubcategoria(servico: MontadorServico) {
  const raw = servico.subcategoria ?? servico.categoria;
  if (!raw) return "Montagem e reparos";
  return String(raw).replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function formatDateTime(servico: MontadorServico) {
  const date = servico.data ? new Date(servico.data) : null;
  const dateLabel =
    date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
      : "Data a combinar";
  const turno = String(servico.turno ?? "").toUpperCase();
  const turnoLabel = turno === "MANHA" ? "Manhã" : turno === "TARDE" ? "Tarde" : "Horário a combinar";
  return `${dateLabel} · ${turnoLabel}`;
}

export function isToday(servico: MontadorServico) {
  if (!servico.data) return false;
  const date = new Date(servico.data);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export function localResumo(servico: MontadorServico, full = false) {
  if (full && servico.enderecoCompleto) return servico.enderecoCompleto;
  if (servico.endereco) return servico.endereco;
  const parts = [servico.bairro, servico.cidade, servico.uf].filter(Boolean);
  return parts.length ? parts.join(", ") : "Endereço liberado após aceite";
}

export function statusLabel(statusValue: unknown) {
  const status = upperStatus(statusValue);
  if (status === "SOLICITADO" || status === "PENDENTE") return "Pendente";
  if (status === "ACEITO") return "Aceito";
  if (status === "CONFIRMADO") return "Confirmado";
  if (status === "EM_ANDAMENTO") return "Em andamento";
  if (status === "AGUARDANDO_FINALIZACAO") return "Aguardando finalização";
  if (status === "FINALIZADO" || status === "CONCLUIDO") return "Finalizado";
  if (status === "CANCELADO") return "Cancelado";
  if (status === "RECUSADO") return "Recusado";
  if (status === "EXPIRADO") return "Expirado";
  return "Status não informado";
}
