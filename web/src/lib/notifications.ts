import { prisma } from "@/lib/prisma";

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

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
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

  try {
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
