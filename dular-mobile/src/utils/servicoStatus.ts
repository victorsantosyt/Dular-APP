/**
 * Helpers de status de serviço — usados para decidir quais ações de
 * "serviço ativo" (cancelar, iniciar, reagendar) podem ser exibidas.
 *
 * Status encerrados nunca mostram ações de serviço ativo. Ações de
 * pós-finalização (avaliar, confirmar finalização pelo cliente) seguem
 * sendo controladas pela lógica específica de cada tela.
 */

export const STATUS_ENCERRADOS = [
  "CONCLUIDO",
  "CONCLUÍDO",
  "CONFIRMADO",
  "FINALIZADO",
  "FINALIZADO_CLIENTE",
  "PAGO",
  "AVALIADO",
  "CANCELADO",
  "RECUSADO",
] as const;

export type StatusEncerrado = typeof STATUS_ENCERRADOS[number];

export function isStatusEncerrado(status: unknown): boolean {
  const value = String(status ?? "").toUpperCase();
  return (STATUS_ENCERRADOS as readonly string[]).includes(value);
}
