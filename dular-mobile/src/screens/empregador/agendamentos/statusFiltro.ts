import type { AgendamentoItem, StatusFiltro } from "./components";

/**
 * Filtro por STATUS CRU do backend (não pelo bucket visual).
 *
 * Os quatro baldes particionam o `enum ServicoStatus` inteiro — dez valores,
 * sem lacuna e sem sobreposição. É por isso que "Todos" não precisa (e não
 * deve) repetir a lista: ele é a AUSÊNCIA de filtro, não a união escrita à mão.
 * Uma lista manual envelheceria calada no dia em que o enum ganhasse um valor
 * novo, e o item sumiria da tela sem ninguém perceber.
 *
 * `PENDENTE` nunca existiu em `ServicoStatus` — o `0_init` já criou o enum sem
 * ele e a única migration que o alterou foi a de `AGUARDANDO_FINALIZACAO`.
 * É valor morto, mantido aqui porque remover não melhora nada e conservar
 * falha fechado: um status que nunca chega nunca casa.
 */
export const STATUS_FILTER_RAW: Record<Exclude<StatusFiltro, "todas">, string[]> = {
  aguardando: ["SOLICITADO", "PENDENTE", "RASCUNHO"],
  aceitas: ["ACEITO", "EM_ANDAMENTO", "AGUARDANDO_FINALIZACAO"],
  concluidas: ["CONCLUIDO", "CONFIRMADO", "FINALIZADO"],
  canceladas: ["CANCELADO", "RECUSADO"],
};

/**
 * Decide se um item entra no filtro de status escolhido.
 *
 * Recebe só o que lê (`statusRaw`) para poder ser exercitado sem montar um
 * `AgendamentoItem` inteiro; qualquer `AgendamentoItem` continua servindo.
 */
export function statusMatchesFilter(
  item: Pick<AgendamentoItem, "statusRaw">,
  status: StatusFiltro,
): boolean {
  // "Todos" = todos os itens carregados, qualquer que seja o status.
  // Antes daqui ele repetia o balde de "Aguardando", o que fazia os dois chips
  // serem o mesmo filtro e escondia serviços aceitos de quem abria a tela.
  if (status === "todas") return true;
  return STATUS_FILTER_RAW[status].includes(item.statusRaw);
}
