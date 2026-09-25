import type { AppIconName } from "@/components/ui/AppIcon";
import type { ProfileTheme } from "@/theme/profileTheme";
import { colors } from "@/theme/tokens";

/**
 * Identidade visual das notificações — ícone, rótulo e tom por tipo.
 *
 * Fica aqui, e não dentro de uma tela, porque a MESMA notificação aparece em
 * dois lugares: no aviso que salta quando ela chega (NotificacaoPopup) e na
 * lista da tela de Notificações. Com dois mapas separados, um aceite de
 * serviço saltava com um ícone e uma cor e, segundos depois, aparecia na lista
 * com outro ícone e outra cor — parecia coisa diferente.
 */
export type NotificationTone = "primary" | "urgent" | "success" | "info";

export type NotificacaoMeta = { icon: AppIconName; badge: string; tone: NotificationTone };

export const TYPE_META: Record<string, NotificacaoMeta> = {
  SERVICO_SOLICITADO: { icon: "BriefcaseBusiness", badge: "Solicitação", tone: "primary" },
  SERVICO_ACEITO: { icon: "CheckCircle", badge: "Aceito", tone: "success" },
  SERVICO_RECUSADO: { icon: "XCircle", badge: "Recusado", tone: "urgent" },
  SERVICO_INICIADO: { icon: "Clock", badge: "Em andamento", tone: "info" },
  SERVICO_FINALIZADO: { icon: "CheckCircle", badge: "Concluído", tone: "success" },
  SERVICO_CANCELADO: { icon: "XCircle", badge: "Cancelado", tone: "urgent" },
  SERVICO_REAGENDAMENTO_PROPOSTO: { icon: "Clock", badge: "Reagendamento", tone: "info" },
  SERVICO_REAGENDAMENTO_CONFIRMADO: { icon: "CheckCircle", badge: "Reagendado", tone: "success" },
  SERVICO_REAGENDAMENTO_RECUSADO: { icon: "XCircle", badge: "Reagendamento", tone: "urgent" },
  // Mensagem segue o tema do perfil, não uma cor semântica: o tom "support"
  // usava `colors.info` (#7B4EDB, o roxo do Empregador), e uma mensagem
  // chegava roxa dentro do perfil rosa da diarista. Recado de cliente não é
  // um estado (erro/sucesso) — é atividade normal do app, cor do perfil.
  MENSAGEM_RECEBIDA: { icon: "MessageCircle", badge: "Mensagem", tone: "primary" },
  CHAT_NOVA_MENSAGEM: { icon: "MessageCircle", badge: "Mensagem", tone: "primary" },
  AVALIACAO_RECEBIDA: { icon: "Star", badge: "Avaliação", tone: "success" },
  ALERTA_SEGURANCA: { icon: "AlertTriangle", badge: "Urgente", tone: "urgent" },
  SISTEMA: { icon: "Sparkles", badge: "Novidade", tone: "primary" },
  NOVIDADE: { icon: "Megaphone", badge: "Novidade", tone: "primary" },
};

const PADRAO: NotificacaoMeta = { icon: "Bell", badge: "Aviso", tone: "primary" };

/** Tipo desconhecido (backend novo, app antigo) cai num aviso genérico. */
export function metaDoTipo(tipo: string | null | undefined): NotificacaoMeta {
  return (tipo && TYPE_META[tipo]) || PADRAO;
}

/**
 * Cor do tom. Só desvia do tema do perfil quando o aviso é um ESTADO que
 * precisa ser lido como tal: recusa/cancelamento (vermelho), conclusão
 * (verde), algo em curso (âmbar). O resto usa a cor do perfil.
 */
export function tonePalette(tone: NotificationTone, theme: ProfileTheme) {
  if (tone === "urgent") return { accent: colors.danger, soft: colors.dangerSoft };
  if (tone === "success") return { accent: colors.success, soft: colors.successSoft };
  if (tone === "info") return { accent: colors.warning, soft: colors.warningSoft };
  return { accent: theme.primary, soft: theme.primarySoft };
}

/** Notificações de chat: só sinalizadas em Mensagens, nunca na lista de Notificações. */
export { CHAT_TYPES } from "@/lib/destinoNotificacao";
