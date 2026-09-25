/**
 * Quem está autenticado AGORA (id do usuário), para caches e listeners
 * conferirem a sessão sem importar o authStore (evita ciclo de import). O
 * authStore mantém este valor em dia; `null` = ninguém autenticado.
 */
let usuarioAtual: string | null = null;

export function definirSessaoAtual(userId: string | null) {
  usuarioAtual = userId;
}

export function sessaoAtual(): string | null {
  return usuarioAtual;
}
