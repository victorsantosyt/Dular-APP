/**
 * Quem está autenticado AGORA (id do usuário), para caches e listeners
 * conferirem a sessão sem importar o authStore (evita ciclo de import). O
 * authStore mantém este valor em dia; `null` = ninguém autenticado.
 *
 * `epocaSessao()` muda a cada troca — inclusive sair e entrar de novo na MESMA
 * conta (A → ninguém → A). Cache que guarda a época junto do dado nunca serve,
 * nem grava, resposta pedida em outra sessão.
 */
let usuarioAtual: string | null = null;
let epoca = 0;

export function definirSessaoAtual(userId: string | null) {
  if (userId !== usuarioAtual) epoca++;
  usuarioAtual = userId;
}

export function sessaoAtual(): string | null {
  return usuarioAtual;
}

export function epocaSessao(): number {
  return epoca;
}
