/**
 * Por que o perfil da diarista aparece — ou não — na busca dos empregadores.
 *
 * Isto NÃO é a completude dos dados, e a separação é o ponto: até aqui a tela
 * inferia visibilidade só pelo percentual, e afirmava "Seu perfil está
 * completo e aparece na busca para empregadores" com os cinco blocos
 * preenchidos. Só que o backend também exige `profile.ativo` e conta ATIVA —
 * `getDiaristaProfileCompleteness` reprova os dois com `perfil_inativo` e
 * `usuario_bloqueado` — e nada disso chegava à interface.
 *
 * Resultado medido na auditoria: perfil inativo e conta bloqueada apareciam
 * como "100% completo, aparece na busca" no app enquanto o backend os
 * excluía da busca. Não era número errado; era informação errada.
 *
 * Os dois conceitos continuam separados de propósito:
 *
 *   completude dos dados  — os cinco blocos foram preenchidos? Vira percentual.
 *   elegibilidade         — esse perfil pode ser encontrado? Vira este estado.
 *
 * Conta bloqueada não derruba o percentual para 80%: os dados continuam lá, e
 * dizer que "falta preencher algo" mandaria a pessoa procurar um campo vazio
 * que não existe. O percentual segue dos dados; a visibilidade, daqui.
 *
 * A verificação documental é uma TERCEIRA coisa, e continua onde estava: um
 * documento pendente também impede a busca, mas se resolve enviando documento
 * — ao contrário de conta bloqueada, que não se resolve pelo app.
 */
export type EstadoVisibilidadeDiarista =
  | "ELEGIVEL"
  | "DADOS_INCOMPLETOS"
  | "PERFIL_INATIVO"
  | "CONTA_BLOQUEADA"
  | "CONTA_REMOVIDA"
  | "STATUS_INDETERMINADO";

export function estadoDeVisibilidadeDiarista(params: {
  /** A completude dos cinco blocos já fechou? */
  dadosCompletos: boolean;
  /** `profile.ativo` — o toggle "Ficar visível na busca". */
  profileAtivo: boolean | null | undefined;
  /** `user.status` — ATIVO, BLOQUEADO, REMOVIDO. */
  userStatus: string | null | undefined;
}): EstadoVisibilidadeDiarista {
  const { dadosCompletos, profileAtivo, userStatus } = params;

  // A ordem é do que a pessoa NÃO resolve sozinha para o que ela resolve.
  // Conta bloqueada primeiro: de nada adianta apontar um campo vazio para
  // quem está barrado por moderação.
  //
  // A comparação é `!== "ATIVO"`, e não `=== "BLOQUEADO"`, pelo mesmo motivo
  // do backend: status nulo, ausente ou um valor futuro que ninguém previu
  // precisa recusar, não passar. Falha fechado.
  if (userStatus !== "ATIVO") {
    if (userStatus === "REMOVIDO") return "CONTA_REMOVIDA";
    if (userStatus === "BLOQUEADO") return "CONTA_BLOQUEADA";
    return "STATUS_INDETERMINADO";
  }

  // `ativo` é escolha da própria diarista (o toggle do perfil). Vem depois do
  // status porque é reversível com um toque.
  if (!profileAtivo) return "PERFIL_INATIVO";

  if (!dadosCompletos) return "DADOS_INCOMPLETOS";

  // Elegível pelos critérios de cadastro. A verificação documental ainda pode
  // barrar a busca, e é avaliada depois — por isso o nome não é "VISIVEL".
  return "ELEGIVEL";
}

/** Se o app pode afirmar que o perfil aparece na busca. */
export function podeAfirmarVisibilidade(estado: EstadoVisibilidadeDiarista): boolean {
  return estado === "ELEGIVEL";
}
