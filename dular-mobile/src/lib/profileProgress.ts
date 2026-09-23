/**
 * Se a barra "Perfil X% completo" deve aparecer.
 *
 * Três estados, e o primeiro é o que elimina o piscar: enquanto os dados
 * canônicos não chegaram não existe percentual algum a mostrar. Hoje os três
 * perfis caem em `?? 0` ou calculam sobre um objeto nulo, então a tela abre
 * com "0%", salta para o valor real e às vezes some — tudo em menos de um
 * segundo, e o usuário vê o pulo.
 *
 * O segundo ponto é a separação entre DUAS coisas que hoje se misturam:
 *
 *   completude do perfil   — os campos foram preenchidos?
 *   verificação documental — o documento foi enviado e aprovado?
 *
 * Um perfil pode estar 100% preenchido com o documento ainda pendente. Nesse
 * caso o card de verificação continua fazendo sentido, mas a barra de
 * percentual não: ela diria "100%" para sempre, ao lado de um aviso que nada
 * tem a ver com preenchimento. Por isso quem decide a barra é só a completude.
 */
export type EstadoCompletude = "UNKNOWN" | "INCOMPLETE" | "COMPLETE";

export function estadoDaCompletude(params: {
  /** Os dados canônicos do perfil já chegaram? */
  carregado: boolean;
  /** Percentual do backend ou do cálculo local; nulo quando ainda não há. */
  progresso: number | null | undefined;
  /** Sinal explícito de completo, quando a fonte oferece um. */
  completo?: boolean | null;
}): EstadoCompletude {
  if (!params.carregado) return "UNKNOWN";

  // `completo` é a palavra final quando existe: é o que a fonte canônica
  // afirma, e não depende de arredondamento do percentual.
  if (params.completo === true) return "COMPLETE";

  const progresso = params.progresso;
  if (progresso == null) return "UNKNOWN";
  if (progresso >= 100) return "COMPLETE";

  return "INCOMPLETE";
}

/**
 * A barra aparece em um único caso: dados carregados e perfil incompleto.
 * Nem durante o carregamento, nem depois de completo.
 */
export function deveMostrarProgresso(estado: EstadoCompletude): boolean {
  return estado === "INCOMPLETE";
}
