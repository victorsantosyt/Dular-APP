/**
 * A régua de frequência do pedido de nota na loja — e nada além disso.
 *
 * POR QUE ESTE ARQUIVO EXISTE SEPARADO
 *
 * Ele não importa NADA de React Native. É o que permite rodar a regra em Node
 * puro (`node --import tsx`), sem simulador, sem AsyncStorage e sem a loja —
 * e o projeto mobile não tem runner de teste, então a alternativa seria não
 * conseguir exercitar esta lógica de jeito nenhum.
 *
 * A aritmética de "90 dias" e "2 por ano" é justamente onde um erro passa
 * despercebido: ele não quebra nada, só faz o app pedir demais (e a loja
 * ignorar em silêncio) ou nunca pedir.
 *
 * Quem faz I/O é `avaliacaoDaLoja.ts`; aqui só há decisão.
 */

/** Abaixo disso a pessoa não teve uma boa experiência — não se pede nota. */
export const NOTA_MINIMA = 4;

/**
 * Quantos serviços bem avaliados antes do PRIMEIRO pedido. Pedir na primeira
 * vez é pedir a quem ainda não formou opinião; o app vira o chato que
 * interrompe antes de ter entregue algo.
 */
export const SUCESSOS_ANTES_DO_PRIMEIRO = 2;

/** Intervalo mínimo entre dois pedidos. */
export const DIAS_ENTRE_PEDIDOS = 90;

/**
 * Teto por ano. A Apple corta em ~3 pedidos por 365 dias e não avisa quando
 * ignora; ficamos em 2 de propósito, para o pedido nunca ser desperdiçado num
 * limite invisível.
 */
export const PEDIDOS_POR_ANO = 2;

export const DIA_MS = 24 * 60 * 60 * 1000;
export const ANO_MS = 365 * DIA_MS;

export type EstadoDaAvaliacao = {
  /** Nota do serviço que acabou de ser avaliado, 1 a 5. */
  nota: number;
  /** Serviços bem avaliados até aqui, já contando o atual. */
  sucessos: number;
  /** Quando cada pedido anterior foi feito (epoch ms). */
  pedidos: number[];
  agora: number;
};

/** Pedidos que ainda contam para o teto anual. */
export function pedidosNoUltimoAno(pedidos: number[], agora: number): number[] {
  return pedidos.filter((t) => agora - t < ANO_MS);
}

/**
 * Pode pedir a nota agora?
 *
 * Nenhuma das condições consulta a pessoa: não há "está gostando do app?" em
 * lugar nenhum, porque pré-pergunta viola a política do Google Play. O filtro
 * está no momento — serviço concluído e bem avaliado — e na frequência.
 */
export function podePedirAvaliacao(estado: EstadoDaAvaliacao): boolean {
  const { nota, sucessos, pedidos, agora } = estado;

  if (!Number.isFinite(nota) || nota < NOTA_MINIMA) return false;
  if (sucessos < SUCESSOS_ANTES_DO_PRIMEIRO) return false;

  const recentes = pedidosNoUltimoAno(pedidos, agora);
  if (recentes.length >= PEDIDOS_POR_ANO) return false;

  const ultimo = recentes.length > 0 ? Math.max(...recentes) : 0;
  if (ultimo > 0 && agora - ultimo < DIAS_ENTRE_PEDIDOS * DIA_MS) return false;

  return true;
}
