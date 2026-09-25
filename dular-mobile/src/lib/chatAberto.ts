/**
 * Qual conversa está na tela agora (id do serviço), para o push em primeiro
 * plano não mostrar popup da conversa que a pessoa já está lendo. Registrada
 * no foco da tela de chat e limpa no blur/desmontagem.
 */
type ChatAberto = { servicoId: string; atualizar: () => Promise<void> };

let atual: ChatAberto | null = null;

export function definirChatAberto(servicoId: string, atualizar: () => Promise<void>) {
  atual = { servicoId, atualizar };
}

/** Só limpa se ainda for a mesma conversa (um foco novo pode ter chegado antes). */
export function limparChatAberto(servicoId: string) {
  if (atual?.servicoId === servicoId) atual = null;
}

export function chatAbertoAtual(): ChatAberto | null {
  return atual;
}
