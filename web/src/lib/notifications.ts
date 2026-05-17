import { prisma } from "@/lib/prisma";

// ──────────────────────────────────────────────────────────────────────────
// Notificações in-app + push remoto (best-effort)
//
// Toda a comunicação transacional do app (T-16) passa por estes helpers.
// • `criarNotificacao` persiste a notificação no banco para a aba
//   "Notificações" do mobile e, em paralelo, dispara o push remoto.
// • `sendPushNotification` continua exportado por compatibilidade — vários
//   endpoints já o chamam diretamente; novos lugares devem preferir
//   `criarNotificacao` (que faz as duas coisas).
//
// Importante: falhas no envio (push remoto ou row no banco) **nunca** podem
// derrubar o endpoint principal. Todos os pontos críticos estão envolvidos
// em try/catch, e o erro é apenas logado no console.
// ──────────────────────────────────────────────────────────────────────────

export type NotificationType =
  | "SERVICO_SOLICITADO"
  | "SERVICO_ACEITO"
  | "SERVICO_RECUSADO"
  | "SERVICO_CANCELADO"
  | "SERVICO_INICIADO"
  | "SERVICO_AGUARDANDO_FINALIZACAO"
  | "SERVICO_FINALIZADO"
  | "SERVICO_CONFIRMADO"
  | "CHAT_NOVA_MENSAGEM";

type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default";
  badge?: number;
};

type PushTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: unknown;
};

/**
 * Envia push remoto via Expo. Best-effort: nunca lança — erros são logados
 * e o fluxo principal segue normalmente. Em desenvolvimento (Expo Go) o
 * token pode não estar disponível: nesse caso a função simplesmente retorna.
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushToken: true },
    });

    const token = user?.pushToken;
    if (!token || !token.startsWith("ExponentPushToken[")) return;

    const message: PushMessage = {
      to: token,
      title,
      body,
      sound: "default",
      ...(data ? { data } : {}),
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
    };

    if (process.env.EXPO_ACCESS_TOKEN) {
      headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
    }

    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers,
      body: JSON.stringify(message),
    });

    const json = (await res.json()) as { data?: PushTicket };
    const ticket = json.data;
    if (ticket?.status === "error") {
      console.error("[push] erro ao enviar notificação:", ticket.message, ticket.details);
    }
  } catch (err) {
    console.error("[push] falha na chamada à Expo Push API:", err);
  }
}

export type CriarNotificacaoParams = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  servicoId?: string | null;
  chatRoomId?: string | null;
  /**
   * Quando definido, sobrescreve o `data` do push remoto. Por padrão
   * incluímos `{ type, servicoId, chatRoomId }` para o mobile rotear a
   * notificação para a tela correta.
   */
  pushData?: Record<string, unknown>;
  /**
   * Quando `false`, apenas cria a row in-app e pula o push remoto.
   * Útil para notificações em massa onde push individual não faz sentido.
   * Padrão: `true`.
   */
  sendPush?: boolean;
};

/**
 * Cria uma notificação in-app e dispara o push remoto (best-effort).
 *
 * Esta é a função preferencial para qualquer notificação transacional do
 * app. Falhas em qualquer etapa são apenas logadas — nunca propagadas —
 * para garantir que o endpoint principal sempre conclua com sucesso.
 */
export async function criarNotificacao(params: CriarNotificacaoParams) {
  const {
    userId,
    type,
    title,
    body,
    servicoId = null,
    chatRoomId = null,
    pushData,
    sendPush = true,
  } = params;

  let notification: { id: string } | null = null;
  try {
    notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        servicoId,
        chatRoomId,
      },
      select: { id: true },
    });
  } catch (e) {
    console.error("[notifications] erro criando notification in-app:", e);
  }

  if (sendPush) {
    const data: Record<string, unknown> = pushData ?? {
      type,
      ...(servicoId ? { servicoId } : {}),
      ...(chatRoomId ? { chatRoomId } : {}),
      ...(notification?.id ? { notificationId: notification.id } : {}),
    };
    // sendPushNotification já trata erros internamente; este await é seguro.
    await sendPushNotification(userId, title, body, data);
  }

  return notification;
}

/**
 * Alias semântico para deixar explícito nos call-sites que o push é
 * best-effort. Internamente delega para `sendPushNotification`.
 */
export async function enviarPushBestEffort(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  await sendPushNotification(userId, title, body, data);
}
