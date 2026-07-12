import * as Ably from "ably";
import { api } from "@/lib/api";

// Wrapper do SDK Ably para o mobile. A conexão é SEMPRE autenticada por TOKEN
// emitido pelo backend (GET /api/realtime/token) — o mobile NUNCA recebe nem usa
// a ABLY_API_KEY. Cliente é singleton: nunca há mais de uma conexão viva.

let realtimeSingleton: Ably.Realtime | null = null;

// Estados terminais/ociosos: se a conexão anterior foi fechada (close() ao sair
// da sala) ou falhou, recriamos o cliente na próxima sala — preservando a
// garantia de "no máximo uma conexão viva por vez".
const DEAD_STATES = ["closed", "closing", "failed"];

/**
 * Retorna o cliente Realtime singleton, autenticado por token.
 *
 * `authCallback` busca um TokenRequest novo no backend a cada (re)autenticação —
 * nenhuma API Key vive no cliente. `autoConnect: false`: quem controla o
 * connect/close é a sala (useChat), não o import.
 */
export function getAblyRealtime(): Ably.Realtime {
  if (!realtimeSingleton || DEAD_STATES.includes(realtimeSingleton.connection.state)) {
    realtimeSingleton = new Ably.Realtime({
      autoConnect: false,
      authCallback: async (_params, callback) => {
        try {
          const res = await api.get("/api/realtime/token");
          callback(null, res.data?.tokenRequest ?? null);
        } catch (err) {
          callback(err instanceof Error ? err.message : String(err), null);
        }
      },
    });
  }
  return realtimeSingleton;
}

export { Ably };
