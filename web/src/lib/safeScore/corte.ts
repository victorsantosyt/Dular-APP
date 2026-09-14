/**
 * Corte de bloqueio do SafeScore: abaixo dele o Guardian barra ações sensíveis
 * e o profissional sai das buscas.
 *
 * Fonte única. Antes o 400 estava copiado no Guardian, em diaristas/buscar e
 * no `getFaixa().bloqueado` que montadores/buscar usa, cada cópia com um
 * comentário dizendo que "espelhava" a outra.
 *
 * Escala: a mesma nos dois ledgers, de 0 a 1000, começando em 500. O V2 guarda
 * Float e o corte é `<`: 399.5 bloqueia, 400 não.
 *
 * Fica no código, não na política V2: a política 1.1.0 só tem pesos. Levar o
 * corte para lá pede uma versão nova da política e uma leitura dela no Guardian
 * e nas buscas.
 */
export const SCORE_BLOQUEIO = 400;

export function scoreBloqueado(score: number): boolean {
  return score < SCORE_BLOQUEIO;
}
