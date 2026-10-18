/**
 * O que um push remoto pode MOSTRAR fora do app.
 *
 * Com o app em segundo plano ou fechado, quem exibe o push é o sistema (Android
 * e iOS), sem rodar código do app — nenhum filtro no aparelho alcança esse
 * caso. E o token do aparelho pode estar associado a uma conta que já saiu
 * dele (logout sem rede, troca de conta). Por isso título e corpo do push são
 * SEMPRE textos fixos por tipo, definidos aqui: nunca nome de quem mandou,
 * texto de mensagem, bairro, endereço ou qualquer dado do evento. O conteúdo
 * completo continua na notificação gravada no banco, que só a pessoa
 * autenticada lê dentro do app.
 *
 * Tipo fora da lista cai no texto genérico: aviso novo nasce seguro.
 */
import type { NotificationType } from "@/lib/notifications";

export type ConteudoPublico = { title: string; body: string };

export const CONTEUDO_PUBLICO: Record<NotificationType, ConteudoPublico> = {
  SERVICO_SOLICITADO: { title: "Nova solicitação", body: "Você recebeu uma nova solicitação no Dular." },
  SERVICO_ACEITO: { title: "Solicitação aceita", body: "Uma solicitação foi aceita. Abra o Dular para ver." },
  SERVICO_RECUSADO: { title: "Solicitação recusada", body: "Uma solicitação foi recusada. Abra o Dular para ver." },
  SERVICO_CANCELADO: { title: "Serviço cancelado", body: "Um serviço foi cancelado. Abra o Dular para ver." },
  SERVICO_INICIADO: { title: "Serviço iniciado", body: "Um serviço foi iniciado. Abra o Dular para ver." },
  SERVICO_AGUARDANDO_FINALIZACAO: {
    title: "Confirme a finalização",
    body: "Um serviço aguarda a sua confirmação no Dular.",
  },
  SERVICO_FINALIZADO: { title: "Serviço finalizado", body: "Um serviço foi finalizado. Abra o Dular para ver." },
  SERVICO_CONFIRMADO: { title: "Serviço confirmado", body: "Um serviço foi confirmado. Abra o Dular para ver." },
  SERVICO_REAGENDAMENTO_PROPOSTO: {
    title: "Novo horário proposto",
    body: "Há uma proposta de novo horário no Dular.",
  },
  SERVICO_REAGENDAMENTO_CONFIRMADO: {
    title: "Novo horário confirmado",
    body: "Um novo horário foi confirmado. Abra o Dular para ver.",
  },
  SERVICO_REAGENDAMENTO_RECUSADO: {
    title: "Novo horário recusado",
    body: "Uma proposta de novo horário foi recusada. Abra o Dular para ver.",
  },
  CHAT_NOVA_MENSAGEM: { title: "Nova mensagem", body: "Você recebeu uma mensagem no Dular." },
  PAGAMENTO_INFORMADO: { title: "Pagamento informado", body: "Um pagamento foi informado. Abra o Dular para conferir." },
  PAGAMENTO_CONFIRMADO: { title: "Recebimento confirmado", body: "Um recebimento foi confirmado. Abra o Dular para ver." },
  PAGAMENTO_CONTESTADO: { title: "Pagamento não recebido", body: "Há um aviso sobre um pagamento. Abra o Dular para ver." },
  VERIFICACAO_APROVADA: { title: "Verificação aprovada", body: "Seus documentos foram aprovados. Abra o Dular para ver." },
  VERIFICACAO_REPROVADA: { title: "Verificação não aprovada", body: "Há uma atualização sobre seus documentos. Abra o Dular para ver." },
};

export const CONTEUDO_GENERICO: ConteudoPublico = {
  title: "Dular",
  body: "Você tem uma nova atualização no Dular.",
};

function ehTipoConhecido(tipo: unknown): tipo is NotificationType {
  return typeof tipo === "string" && Object.prototype.hasOwnProperty.call(CONTEUDO_PUBLICO, tipo);
}

export function conteudoPublico(tipo: unknown): ConteudoPublico {
  return ehTipoConhecido(tipo) ? CONTEUDO_PUBLICO[tipo] : CONTEUDO_GENERICO;
}

/**
 * `data` do push: não é exibido pelo sistema, mas viaja no aviso e fica no
 * aparelho. Só passam as chaves que o app usa para navegar, e só com valor de
 * identificador (letras, números, `_`, `-`). Qualquer outra chave — ou um
 * valor que não pareça id (um nome, um texto) — é descartada.
 */
const CHAVES_PERMITIDAS = ["type", "servicoId", "chatRoomId", "notificationId"] as const;
const FORMATO_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function dadosPublicos(tipo: unknown, data?: Record<string, unknown>): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const chave of CHAVES_PERMITIDAS) {
    const valor = chave === "type" ? tipo : data?.[chave];
    if (typeof valor === "string" && FORMATO_ID.test(valor)) saida[chave] = valor;
  }
  return saida;
}
