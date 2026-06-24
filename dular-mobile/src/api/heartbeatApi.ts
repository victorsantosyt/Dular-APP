import { api } from "@/lib/api";

/**
 * Heartbeat de presença. O mobile chama enquanto uma conversa está aberta
 * (useChat). Silencioso por design — nunca deve lançar/crashar o app.
 */
export async function sendHeartbeat(): Promise<void> {
  try {
    await api.post("/api/me/heartbeat");
  } catch {
    // silencioso — presença é best-effort
  }
}
