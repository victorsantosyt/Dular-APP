/**
 * Motivo técnico → frase que um humano lê.
 *
 * Vivia dentro do VerificacoesClient, onde só a tela de Verificações
 * alcançava. Saiu para cá quando uma segunda tela passou a precisar dos mesmos
 * motivos: duas cópias divergiriam, e a mesma pendência apareceria com nomes
 * diferentes em lugares diferentes do painel.
 *
 * O vocabulário NÃO é único por acidente do domínio: `getDiaristaProfileCompleteness`
 * devolve slugs (`falta_bio`) e `getMontadorProfileCompleteness` devolve frases
 * ("sem bio"). Por isso `rotuloDoMotivo` tem um caminho de saída para o que não
 * está no mapa, em vez de exibir a chave crua ou um vazio.
 */
export const MOTIVO_LABEL: Record<string, string> = {
  documento_aguardando_analise: "Documento aguardando análise",
  documento_nao_enviado: "Documento não enviado",
  documento_reprovado: "Documento reprovado",
  safescore_baixo: "SafeScore abaixo do mínimo",
  score_baixo: "SafeScore abaixo do mínimo",
  usuario_bloqueado: "Usuário bloqueado",
  conta_removida: "Conta excluída pelo titular",
  status_indeterminado: "Status da conta indeterminado",
  usuario_nao_encontrado: "Usuário não encontrado",
  perfil_incompleto: "Perfil incompleto",
  sem_perfil_diarista: "Perfil de Profissional de Casa não encontrado",
  sem_perfil_montador: "Perfil de Montador não encontrado",
  falta_nome: "Nome não informado",
  falta_bio: "Apresentação não informada",
  falta_especialidades: "Especialidades não informadas",
  falta_area_atendimento: "Área de atendimento incompleta",
  perfil_inativo: "Perfil inativo",
  sem_servicos_oferecidos: "Serviços oferecidos não informados",
  sem_localizacao: "Localização não informada",
  sem_preco_diarista: "Preço de diarista não informado",
  sem_preco_baba: "Preço de babá não informado",
  sem_preco_cozinheira: "Preço de cozinheira não informado",
  nao_oferece_diarista: "Serviço de diarista não oferecido",
  nao_oferece_baba: "Serviço de babá não oferecido",
  nao_oferece_cozinheira: "Serviço de cozinheira não oferecido",
  restricao_ativa_suspend_block: "Restrição ativa de suspensão ou bloqueio",
  restricao_shadow_ban: "Restrição ativa de visibilidade",
  restricao_limit_bookings: "Restrição ativa para solicitações",
};

/**
 * Rótulo do motivo. Fora do mapa, devolve o próprio valor legível — os motivos
 * do montador já vêm em português, e um slug novo vira frase em vez de sumir.
 */
export function rotuloDoMotivo(motivo: string): string {
  const conhecido = MOTIVO_LABEL[motivo];
  if (conhecido) return conhecido;
  const texto = motivo.replace(/_/g, " ").trim();
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : motivo;
}
